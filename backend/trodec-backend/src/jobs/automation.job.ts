import cron from "node-cron";
import { supabaseAdmin } from "../config";
import { logger } from "../utils/logger";
import { logisticsService, shiprocketClient } from "../services/logistics.service";
import { brandPayoutService } from "../services/brand_payout.service";

// ---------------------------------------------------------------------------
// Helper: resolve brand pickup + address (duplicated lean version to avoid
// circular imports with order.service which imports logistics.service)
// ---------------------------------------------------------------------------
async function resolveBrandForOrder(orderId: string): Promise<{
  fromAddress: Record<string, unknown>;
  pickupLocation: string;
  toAddress: Record<string, unknown>;
  items: Array<{ name: string; sku: string; units: number; selling_price: number }>;
  totalAmount: number;
}> {
  const { data: orderRow } = await supabaseAdmin
    .from("orders")
    .select("*, order_items(brand_id, product_name, product_price, quantity)")
    .eq("id", orderId)
    .single();

  if (!orderRow) throw new Error(`Order ${orderId} not found`);

  const toAddress = {
    name:       (orderRow as any).shipping_name,
    phone:      (orderRow as any).shipping_phone,
    line1:      (orderRow as any).shipping_address_line1,
    city:       (orderRow as any).shipping_city,
    state:      (orderRow as any).shipping_state,
    postalCode: (orderRow as any).shipping_postal_code,
    country:    (orderRow as any).shipping_country,
  };

  const items = ((orderRow as any).order_items ?? []).map((i: any) => ({
    name:          i.product_name,
    sku:           "SKU-001",
    units:         i.quantity,
    selling_price: i.product_price,
  }));

  const brandId = ((orderRow as any).order_items?.[0] as any)?.brand_id ?? "";
  let fromAddress: Record<string, unknown> = { name: "Trodec Warehouse", city: "Mumbai", country: "India" };
  let pickupLocation = "Primary";

  if (brandId) {
    const { data: addr } = await supabaseAdmin
      .from("addresses")
      .select("full_name, phone_number, address_line1, address_line2, city, state, postal_code, country")
      .eq("user_id", brandId)
      .eq("is_default_shipping", true)
      .maybeSingle();

    if (addr) {
      fromAddress = {
        name:       (addr as any).full_name,
        phone:      (addr as any).phone_number,
        line1:      (addr as any).address_line1,
        city:       (addr as any).city,
        state:      (addr as any).state,
        postalCode: (addr as any).postal_code,
        country:    (addr as any).country,
      };
    }
    pickupLocation = await shiprocketClient.getBrandPickupLocation(brandId);
  }

  return { fromAddress, pickupLocation, toAddress, items, totalAmount: Number((orderRow as any).total ?? 0) };
}

// ---------------------------------------------------------------------------
// Job 1: Retry failed shipment creation
// Runs every 15 minutes.
// Finds confirmed orders with no FORWARD shipment and tries to create one.
// Only attempts orders confirmed in the last 24 hours (older = likely stale).
// ---------------------------------------------------------------------------
async function retryFailedShipments(): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Orders that are confirmed/processing but have no shipment_id
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, shipment_id")
    .in("status", ["confirmed", "processing"])
    .is("shipment_id", null)
    .gte("created_at", since);

  if (!orders?.length) return;

  logger.info(`[AutoJob] retryFailedShipments: ${orders.length} orders need shipment`);

  for (const order of orders) {
    try {
      const { fromAddress, pickupLocation, toAddress, items, totalAmount } =
        await resolveBrandForOrder(order.id);

      await logisticsService.createForwardShipment({
        orderId: order.id,
        fromAddress,
        toAddress,
        items,
        totalAmount,
        pickupLocation,
      });

      logger.info(`[AutoJob] Shipment created for order ${order.order_number}`);
    } catch (err: any) {
      logger.warn(`[AutoJob] Failed to create shipment for ${order.order_number}: ${err?.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Job 2: Retry AWB assignment for shipments with no AWB
// Runs every 30 minutes.
// Finds FORWARD + SAMPLE shipments that have a Shiprocket shipment ID but no AWB
// (usually means wallet was empty at the time of creation).
// ---------------------------------------------------------------------------
async function retryPendingAwb(): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days

  const { data: shipments } = await supabaseAdmin
    .from("shipments")
    .select("id, shiprocket_shipment_id, shiprocket_order_id, order_id")
    .in("type", ["FORWARD", "SAMPLE"])
    .eq("status", "PENDING")
    .is("awb_code", null)
    .not("shiprocket_shipment_id", "is", null)
    .gte("created_at", since);

  if (!shipments?.length) return;

  logger.info(`[AutoJob] retryPendingAwb: ${shipments.length} shipments need AWB`);

  for (const shipment of shipments) {
    try {
      await logisticsService.retryAwbAndDocuments(shipment.id);
      logger.info(`[AutoJob] AWB assigned for shipment ${shipment.id}`);
    } catch (err: any) {
      // Don't log wallet-empty errors as warnings — they're expected
      if (!err?.message?.toLowerCase().includes("wallet") &&
          !err?.message?.toLowerCase().includes("balance")) {
        logger.warn(`[AutoJob] AWB retry failed for shipment ${shipment.id}: ${err?.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Job 3: Sync live tracking for in-transit shipments
// Runs every 2 hours.
// Covers both PENDING+AWB (missed pickup webhook) and SHIPPED (missed transit/delivery
// webhook) for FORWARD + SAMPLE shipments.
// ---------------------------------------------------------------------------
async function syncActiveTracking(): Promise<void> {
  const { data: shipments } = await supabaseAdmin
    .from("shipments")
    .select("id, awb_code")
    .in("type", ["FORWARD", "SAMPLE"])
    .in("status", ["PENDING", "SHIPPED"])
    .not("awb_code", "is", null);

  if (!shipments?.length) return;

  logger.info(`[AutoJob] syncActiveTracking: syncing ${shipments.length} shipments`);

  for (const shipment of shipments) {
    try {
      await logisticsService.trackShipment(shipment.id);
    } catch {
      // Silent — tracking sync is best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Job 4: Safety net — detect missed delivery AND cancellation webhooks
// Runs every 4 hours.
// Checks PENDING+AWB and SHIPPED shipments (FORWARD + SAMPLE) and polls
// Shiprocket for their actual status, then applies any missed transitions:
//   delivered  → FORWARD: commission + brand payout / SAMPLE: pitch → delivered
//   cancelled  → FORWARD: order cancelled + refund + stock restore / SAMPLE: pitch → cancelled
// ---------------------------------------------------------------------------
async function syncShipmentStatuses(): Promise<void> {
  const { data: shipments } = await supabaseAdmin
    .from("shipments")
    .select("id, awb_code, order_id, pitch_id, type")
    .in("type", ["FORWARD", "SAMPLE"])
    .in("status", ["PENDING", "SHIPPED"])
    .not("awb_code", "is", null);

  if (!shipments?.length) return;

  for (const shipment of shipments) {
    try {
      const tracking = await shiprocketClient.trackShipment(shipment.awb_code!);
      if (tracking.canonicalStatus === "delivered") {
        await logisticsService.updateShipmentStatus(shipment.id, "DELIVERED");
        logger.info(`[AutoJob] Missed delivery webhook caught for shipment ${shipment.id}`);
      } else if (tracking.canonicalStatus === "cancelled") {
        await logisticsService.updateShipmentStatus(shipment.id, "RETURNED");
        logger.info(`[AutoJob] Missed cancellation webhook caught for shipment ${shipment.id}`);
      }
    } catch {
      // Silent — best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Job 5: Auto-calculate missing brand payouts
// Runs every hour.
// Finds delivered orders that have no brand_payout row yet (e.g. commission
// calculated but brand payout failed) and runs the calculation.
// ---------------------------------------------------------------------------
async function fixMissingBrandPayouts(): Promise<void> {
  // Delivered orders with commission but no brand_payout
  const { data: rows } = await supabaseAdmin
    .from("commissions")
    .select("order_id")
    .eq("status", "pending");

  if (!rows?.length) return;

  for (const row of rows) {
    const existing = await brandPayoutService.getByOrderId(row.order_id);
    if (existing.length > 0) continue;

    // Verify order is actually delivered before creating payout
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("status")
      .eq("id", row.order_id)
      .single();

    if ((order as any)?.status !== "delivered") continue;

    try {
      await brandPayoutService.calculateAndStore(row.order_id);
      logger.info(`[AutoJob] Fixed missing brand payout for order ${row.order_id}`);
    } catch (err: any) {
      logger.warn(`[AutoJob] Brand payout fix failed for ${row.order_id}: ${err?.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Register all jobs
// ---------------------------------------------------------------------------
export function startAutomationJobs(): void {
  // Every 15 minutes: retry orders that have no shipment
  cron.schedule("*/15 * * * *", () => {
    retryFailedShipments().catch((err) =>
      logger.error("[AutoJob] retryFailedShipments crashed", { err })
    );
  });

  // Every 30 minutes: retry AWB assignment
  cron.schedule("*/30 * * * *", () => {
    retryPendingAwb().catch((err) =>
      logger.error("[AutoJob] retryPendingAwb crashed", { err })
    );
  });

  // Every 2 hours: sync tracking events for in-transit shipments
  cron.schedule("0 */2 * * *", () => {
    syncActiveTracking().catch((err) =>
      logger.error("[AutoJob] syncActiveTracking crashed", { err })
    );
  });

  // Every 4 hours: safety net for missed delivery/cancellation webhooks
  cron.schedule("0 */4 * * *", () => {
    syncShipmentStatuses().catch((err) =>
      logger.error("[AutoJob] syncShipmentStatuses crashed", { err })
    );
  });

  // Every hour: fix any missing brand payouts
  cron.schedule("0 * * * *", () => {
    fixMissingBrandPayouts().catch((err) =>
      logger.error("[AutoJob] fixMissingBrandPayouts crashed", { err })
    );
  });

  logger.info("✅ Automation jobs started: shipment retry (15m), AWB retry (30m), tracking sync (2h), delivery+cancel safety net (4h), payout fix (1h)");
}

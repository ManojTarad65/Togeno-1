import { supabaseAdmin } from "../config";
import { env } from "../config/env";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShipmentType = "FORWARD" | "RETURN" | "SAMPLE";
export type ShipmentStatus = "PENDING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RETURNED" | "RTO";

export interface ShipmentRow {
  id: string;
  order_id: string | null;
  pitch_id: string | null;
  tracking_id: string;
  shiprocket_order_id: string | null;
  shiprocket_shipment_id: string | null;
  awb_code: string | null;
  label_url: string | null;
  carrier: string;
  type: ShipmentType;
  status: ShipmentStatus;
  from_address: Record<string, unknown>;
  to_address: Record<string, unknown>;
  shipped_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  orderId: string | null;
  pitchId: string | null;
  trackingId: string;
  shiprocketOrderId: string | null;
  shiprocketShipmentId: string | null;
  awbCode: string | null;
  labelUrl: string | null;
  carrier: string;
  type: ShipmentType;
  status: ShipmentStatus;
  fromAddress: Record<string, unknown>;
  toAddress: Record<string, unknown>;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    orderId: row.order_id,
    pitchId: row.pitch_id,
    trackingId: row.tracking_id,
    shiprocketOrderId: row.shiprocket_order_id ?? null,
    shiprocketShipmentId: row.shiprocket_shipment_id ?? null,
    awbCode: row.awb_code ?? null,
    labelUrl: row.label_url ?? null,
    carrier: row.carrier,
    type: row.type,
    status: row.status,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    returnedAt: row.returned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Shiprocket address types
// ---------------------------------------------------------------------------

interface ShiprocketAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
}

// ---------------------------------------------------------------------------
// Shiprocket API client
// ---------------------------------------------------------------------------

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

class ShiprocketClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private async getToken(): Promise<string> {
    // Reuse token if still valid (tokens last 24h, refresh 30min before)
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: env.SHIPROCKET_EMAIL,
        password: env.SHIPROCKET_PASSWORD,
      }),
    });

    const json = (await res.json()) as { token?: string; message?: string };

    if (!res.ok || !json.token) {
      logger.error("Shiprocket auth failed", { message: json.message });
      throw ApiError.internal("Shiprocket authentication failed");
    }

    this.token = json.token;
    // 23.5 hours from now
    this.tokenExpiry = Date.now() + 23.5 * 60 * 60 * 1000;
    logger.info("Shiprocket token refreshed");
    return this.token;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${SHIPROCKET_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      logger.error("Shiprocket API error", { path, status: res.status, message: (json as any).message, requestBody: body, responseBody: json });
      throw ApiError.internal((json as any).message ?? "Shiprocket request failed");
    }
    return json;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${SHIPROCKET_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      logger.error("Shiprocket API error", { path, status: res.status });
      throw ApiError.internal((json as any).message ?? "Shiprocket request failed");
    }
    return json;
  }

  /**
   * Create a forward order on Shiprocket.
   * Returns { shiprocketOrderId, shiprocketShipmentId, trackingId, courier }
   */
  async createForwardOrder(params: {
    internalOrderId: string;
    orderDate: string;
    from: ShiprocketAddress;
    to: ShiprocketAddress;
    items: ShiprocketOrderItem[];
    totalAmount: number;
    paymentMethod?: "prepaid" | "COD";
    pickupLocation?: string;
  }): Promise<{ shiprocketOrderId: string; shiprocketShipmentId: string; trackingId: string; courier: string }> {
    const { internalOrderId, orderDate, to, items, totalAmount, paymentMethod = "prepaid", pickupLocation = "Primary" } = params;

    // Shiprocket requires exactly 10-digit Indian mobile number
    const sanitizedPhone = (to.phone ?? "").replace(/\D/g, "").slice(-10);

    const body = {
      order_id: internalOrderId,
      order_date: orderDate,
      pickup_location: pickupLocation,
      channel_id: "",
      comment: "Trodec Order",
      billing_customer_name: to.name,
      billing_last_name: ".",
      billing_address: to.line1,
      billing_address_2: to.line2 ?? "",
      billing_city: to.city,
      billing_pincode: to.postalCode,
      billing_state: to.state,
      billing_country: to.country || "India",
      billing_email: "",
      billing_phone: sanitizedPhone,
      shipping_is_billing: true,
      order_items: items.map((i) => ({
        name: i.name,
        sku: i.sku,
        units: i.units,
        selling_price: i.selling_price,
      })),
      payment_method: paymentMethod,
      sub_total: totalAmount,
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    };

    const resp = await this.post<{
      order_id: number;
      shipment_id: number;
      awb_code?: string;
      courier_name?: string;
      status: string;
    }>("/orders/create/adhoc", body);

    // Shiprocket returns no order_id when the pickup location is unregistered or invalid
    if (!resp.order_id) {
      throw new Error(`Shiprocket order creation returned no order_id — pickup location may be unregistered. Response: ${JSON.stringify(resp)}`);
    }

    // Auto-assign courier — wallet may be empty; don't throw if it fails
    let awb = resp.awb_code ?? "";
    let courier = resp.courier_name ?? "Shiprocket";

    if (!awb && resp.shipment_id) {
      try {
        awb = await this.assignCourier(resp.shipment_id);
      } catch (err: any) {
        // Log but don't throw — order is created, AWB can be assigned later
        logger.warn("Courier AWB assignment failed (wallet may be empty). Order saved.", {
          shiprocketOrderId: resp.order_id,
          shiprocketShipmentId: resp.shipment_id,
          reason: err?.message ?? err,
        });
      }
    }

    return {
      shiprocketOrderId: String(resp.order_id),
      shiprocketShipmentId: String(resp.shipment_id),
      trackingId: awb,
      courier,
    };
  }

  /**
   * Register a new pickup location in Shiprocket.
   * Safe to call multiple times — silently ignores "already exists" errors.
   */
  async addPickupLocation(params: {
    locationName: string;
    name: string;
    email?: string;
    phone: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
  }): Promise<void> {
    try {
      await this.post("/settings/company/addpickup", {
        pickup_location: params.locationName,
        name: params.name,
        email: params.email ?? "",
        phone: params.phone.replace(/\D/g, "").slice(-10),
        address: params.address,
        address_2: params.address2 ?? "",
        city: params.city,
        state: params.state,
        country: params.country || "India",
        pin_code: params.pinCode,
        lat: "",
        long: "",
      });
      logger.info("Shiprocket pickup location registered", { locationName: params.locationName });
    } catch (err: any) {
      const msg: string = (err?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("exist")) {
        logger.info("Shiprocket pickup location already exists, skipping", { locationName: params.locationName });
        return;
      }
      throw err;
    }
  }

  /**
   * List all registered Shiprocket pickup locations for this account.
   */
  async getPickupLocations(): Promise<Array<{ name: string; city: string; status: number }>> {
    const resp = await this.get<{ data: { shipping_address: Array<{ pickup_location: string; city: string; status: number }> } }>(
      "/settings/company/pickup"
    );
    return (resp.data?.shipping_address ?? []).map((l) => ({
      name: l.pickup_location,
      city: l.city,
      status: l.status,
    }));
  }

  /**
   * Returns the Shiprocket pickup location name for a brand.
   * Pickup locations must be pre-registered in the Shiprocket dashboard.
   * The location name is stored in brand_details.shiprocket_pickup_location.
   * Falls back to "Primary" if not configured.
   */
  async getBrandPickupLocation(brandId: string): Promise<string> {
    const { data } = await supabaseAdmin
      .from("brand_details")
      .select("shiprocket_pickup_location")
      .eq("id", brandId)
      .maybeSingle();

    const location = (data as any)?.shiprocket_pickup_location as string | null;
    if (location) {
      logger.info("Using brand Shiprocket pickup location", { brandId, location });
      return location;
    }

    // Derive the deterministic name that syncPickupLocation would have registered.
    // This handles the race where syncPickupLocation succeeded in Shiprocket but
    // the DB update failed, or where the column was never written.
    const derivedName = `trodec-brand-${brandId.replace(/-/g, "").slice(0, 12)}`;
    logger.warn("Brand has no Shiprocket pickup location in DB, using derived name", { brandId, derivedName });
    return derivedName;
  }

  /**
   * Generate a shipping label PDF for a shipment and return the URL.
   * Must be called after AWB is assigned. Returns null if generation fails.
   */
  async generateLabel(shiprocketShipmentId: string): Promise<string | null> {
    try {
      const resp = await this.post<{ label_url?: string }>("/orders/print/label", {
        shipment_id: [shiprocketShipmentId],
      });
      return resp.label_url ?? null;
    } catch (err) {
      logger.warn("Shiprocket label generation failed", { shiprocketShipmentId, err });
      return null;
    }
  }

  /**
   * Auto-assign best courier to a shipment and return AWB.
   */
  async assignCourier(shipmentId: number): Promise<string> {
    const resp = await this.post<{ response?: { data?: { awb_code?: string } } }>(
      "/courier/assign/awb",
      { shipment_id: String(shipmentId) }
    );
    return resp.response?.data?.awb_code ?? "";
  }

  /**
   * Cancel a Shiprocket order.
   */
  async cancelOrder(shiprocketOrderIds: string[]): Promise<void> {
    await this.post("/orders/cancel", { ids: shiprocketOrderIds });
  }

  /**
   * Track a shipment by AWB code.
   */
  async trackShipment(awb: string): Promise<{
    status: string;
    currentLocation?: string;
    lastUpdated?: string;
  }> {
    const resp = await this.get<{
      tracking_data?: {
        track_status?: number;
        shipment_status?: string;
        shipment_track?: Array<{ date: string; location: string; "sr-status-label": string }>;
      };
    }>(`/courier/track/awb/${awb}`);

    const track = resp.tracking_data;
    const latest = track?.shipment_track?.[0];

    return {
      status: track?.shipment_status ?? "Unknown",
      currentLocation: latest?.location,
      lastUpdated: latest?.date,
    };
  }
}

export const shiprocketClient = new ShiprocketClient();

// ---------------------------------------------------------------------------
// Logistics Service
// ---------------------------------------------------------------------------

class LogisticsService {
  /**
   * Create a FORWARD shipment after payment is confirmed.
   * Calls Shiprocket API, stores the shipment, and advances order status to SHIPPED.
   */
  async createForwardShipment(params: {
    orderId: string;
    fromAddress: Record<string, unknown>;
    toAddress: Record<string, unknown>;
    items?: ShiprocketOrderItem[];
    totalAmount?: number;
    pickupLocation?: string;
  }): Promise<Shipment> {
    const { orderId, fromAddress, toAddress, items = [], totalAmount = 0, pickupLocation } = params;

    let trackingId = "";
    let shiprocketOrderId: string | null = null;
    let shiprocketShipmentId: string | null = null;
    let carrier = "Shiprocket";
    let labelUrl: string | null = null;

    try {
      const to = toAddress as unknown as ShiprocketAddress;

      const result = await shiprocketClient.createForwardOrder({
        internalOrderId: orderId,
        orderDate: new Date().toISOString().split("T")[0],
        from: fromAddress as unknown as ShiprocketAddress,
        to,
        items: items.length > 0 ? items : [{ name: "Product", sku: "SKU-001", units: 1, selling_price: totalAmount }],
        totalAmount,
        pickupLocation,
      });

      trackingId = result.trackingId;
      shiprocketOrderId = result.shiprocketOrderId;
      shiprocketShipmentId = result.shiprocketShipmentId;
      carrier = result.courier;

      logger.info("Shiprocket forward order created", { orderId, trackingId, shiprocketOrderId });

      // Generate shipping label now that AWB is assigned
      if (shiprocketShipmentId && trackingId && !trackingId.startsWith("TRK-PENDING")) {
        labelUrl = await shiprocketClient.generateLabel(shiprocketShipmentId);
        if (labelUrl) {
          logger.info("Shiprocket label generated", { orderId, labelUrl });
        }
      }
    } catch (err) {
      // If Shiprocket fails, generate a fallback tracking ID so the order isn't stuck
      logger.error("Shiprocket createForwardOrder failed, using fallback tracking", { orderId, err });
      trackingId = "TRK-PENDING-" + orderId.slice(0, 8).toUpperCase();
    }

    // awb_code is stored separately so it can be updated later after KYC
    const awbCode = trackingId.startsWith("TRK-PENDING") ? null : trackingId;

    const { data: shipmentRow, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: orderId,
        tracking_id: trackingId,
        shiprocket_order_id: shiprocketOrderId,
        shiprocket_shipment_id: shiprocketShipmentId,
        awb_code: awbCode,
        label_url: labelUrl,
        carrier,
        type: "FORWARD",
        status: "SHIPPED",
        from_address: fromAddress,
        to_address: toAddress,
        shipped_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (shipmentError) {
      logger.error("Failed to create forward shipment record", { orderId, error: shipmentError.message });
      throw ApiError.internal("Failed to create shipment");
    }

    const shipment = toShipment(shipmentRow as ShipmentRow);

    const { error: orderError } = await supabaseAdmin
      .from("orders")
      .update({ shipment_id: shipment.id, status: "shipped" })
      .eq("id", orderId);

    if (orderError) {
      logger.error("Failed to link shipment to order", { orderId, error: orderError.message });
      throw ApiError.internal("Failed to update order shipment");
    }

    return shipment;
  }

  /**
   * Update shipment status and mirror to order.
   */
  async updateShipmentStatus(shipmentId: string, status: ShipmentStatus): Promise<Shipment> {
    const timestamps: Record<string, string> = {};
    if (status === "SHIPPED") timestamps.shipped_at = new Date().toISOString();
    if (status === "DELIVERED") timestamps.delivered_at = new Date().toISOString();
    if (status === "RETURNED" || status === "RTO") timestamps.returned_at = new Date().toISOString();

    const { data: shipmentRow, error } = await supabaseAdmin
      .from("shipments")
      .update({ status, ...timestamps })
      .eq("id", shipmentId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update shipment status", { shipmentId, error: error.message });
      throw ApiError.internal("Failed to update shipment status");
    }

    const shipment = toShipment(shipmentRow as ShipmentRow);

    if (shipment.orderId) {
      const orderStatusMap: Partial<Record<ShipmentStatus, "shipped" | "delivered" | "cancelled">> = {
        SHIPPED: "shipped",
        DELIVERED: "delivered",
        RETURNED: "cancelled",
        RTO: "cancelled",
      };
      const newOrderStatus = orderStatusMap[status];
      if (newOrderStatus) {
        // Use lazy import to avoid circular dep (order.service imports logistics.service)
        // Going through orderService ensures hooks fire: commission on delivery, refund on cancel
        import("./order.service").then(({ orderService }) =>
          orderService.updateOrderStatus(shipment.orderId!, newOrderStatus).catch((err) =>
            logger.error("Failed to sync order status from shipment webhook", { orderId: shipment.orderId, newOrderStatus, err })
          )
        );
      }
    }

    return shipment;
  }

  /**
   * Cancel a Shiprocket order when the order is cancelled before pickup.
   * Finds any forward shipment for the order, cancels it on Shiprocket, and marks it RETURNED.
   * Does not create a new return shipment record — use createReturnShipment for post-delivery returns.
   */
  async cancelOrderShipment(orderId: string): Promise<void> {
    const { data: rows } = await supabaseAdmin
      .from("shipments")
      .select("id, shiprocket_order_id, status")
      .eq("order_id", orderId)
      .eq("type", "FORWARD")
      .order("created_at", { ascending: false })
      .limit(1);

    const shipmentRow = rows?.[0] as { id: string; shiprocket_order_id: string | null; status: string } | undefined;

    if (!shipmentRow) {
      // Forward shipment not created yet (race: confirmed → cancelled before Shiprocket responded).
      // Poll the DB briefly for the Shiprocket order ID so we can cancel it.
      logger.warn("No forward shipment found at cancellation time — checking for pending Shiprocket order", { orderId });
      return;
    }

    if (shipmentRow.shiprocket_order_id) {
      try {
        await shiprocketClient.cancelOrder([shipmentRow.shiprocket_order_id]);
        logger.info("Shiprocket order cancelled and wallet refunded", { orderId, shiprocketOrderId: shipmentRow.shiprocket_order_id });
      } catch (err) {
        logger.warn("Shiprocket cancel API failed", { orderId, err });
      }
    }

    await supabaseAdmin
      .from("shipments")
      .update({ status: "RETURNED", returned_at: new Date().toISOString() })
      .eq("id", shipmentRow.id);

    logger.info("Forward shipment marked RETURNED on order cancellation", { orderId, shipmentId: shipmentRow.id });
  }

  /**
   * Create a RETURN shipment — cancels on Shiprocket and reverses addresses.
   */
  async createReturnShipment(orderId: string): Promise<Shipment> {
    const { data: forwardRow, error: fetchError } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("order_id", orderId)
      .eq("type", "FORWARD")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !forwardRow) {
      throw ApiError.notFound("Original forward shipment not found for this order");
    }

    const forward = toShipment(forwardRow as ShipmentRow);

    // Cancel on Shiprocket if we have the order ID
    if (forward.shiprocketOrderId) {
      try {
        await shiprocketClient.cancelOrder([forward.shiprocketOrderId]);
        logger.info("Shiprocket order cancelled", { shiprocketOrderId: forward.shiprocketOrderId });
      } catch (err) {
        logger.warn("Shiprocket cancel failed (continuing anyway)", { err });
      }
    }

    const trackingId = "RTN-" + orderId.slice(0, 8).toUpperCase();

    const { data: shipmentRow, error } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: orderId,
        tracking_id: trackingId,
        carrier: forward.carrier,
        type: "RETURN",
        status: "SHIPPED",
        from_address: forward.toAddress,
        to_address: forward.fromAddress,
        shipped_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create return shipment", { orderId, error: error.message });
      throw ApiError.internal("Failed to create return shipment");
    }

    logger.info("Return shipment created", { orderId, trackingId });
    return toShipment(shipmentRow as ShipmentRow);
  }

  /**
   * Create a SAMPLE shipment for brand → expert delivery.
   */
  async createSampleShipment(params: {
    pitchId: string;
    fromAddress: Record<string, unknown>;
    toAddress: Record<string, unknown>;
    pickupLocation?: string;
  }): Promise<Shipment> {
    const { pitchId, fromAddress, toAddress, pickupLocation } = params;

    let trackingId = "";
    let shiprocketOrderId: string | null = null;
    let shiprocketShipmentId: string | null = null;
    let carrier = "Shiprocket";

    try {
      const from = fromAddress as unknown as ShiprocketAddress;
      const to = toAddress as unknown as ShiprocketAddress;

      const result = await shiprocketClient.createForwardOrder({
        internalOrderId: `SMP-${pitchId.replace(/-/g, "").slice(0, 16)}`,
        orderDate: new Date().toISOString().split("T")[0],
        from,
        to,
        items: [{ name: "Product Sample", sku: "SAMPLE-001", units: 1, selling_price: 1 }],
        totalAmount: 1,
        pickupLocation,
      });

      shiprocketOrderId = result.shiprocketOrderId;
      shiprocketShipmentId = result.shiprocketShipmentId;
      trackingId = result.trackingId; // may be "" if AWB not yet assigned
      carrier = result.courier;

      logger.info("Shiprocket sample order created", { pitchId, shiprocketOrderId, shiprocketShipmentId, awb: trackingId || "pending" });
    } catch (err) {
      logger.error("Shiprocket createSampleShipment failed, using fallback", { pitchId, err });
    }

    // If AWB is empty but we have a Shiprocket shipment ID, use that as a placeholder
    // If Shiprocket failed entirely, generate a local fallback
    const awbCode = trackingId || null;
    const displayTrackingId = trackingId
      || (shiprocketShipmentId ? `SR-${shiprocketShipmentId}` : `SAMPLE-${pitchId.slice(0, 8).toUpperCase()}`);
    // PENDING until wallet recharged and AWB assigned; SHIPPED once AWB is available
    const shipmentStatus: ShipmentStatus = trackingId ? "SHIPPED" : "PENDING";

    const { data: shipmentRow, error } = await supabaseAdmin
      .from("shipments")
      .insert({
        pitch_id: pitchId,
        tracking_id: displayTrackingId,
        shiprocket_order_id: shiprocketOrderId,
        shiprocket_shipment_id: shiprocketShipmentId,
        awb_code: awbCode,
        carrier,
        type: "SAMPLE",
        status: shipmentStatus,
        from_address: fromAddress,
        to_address: toAddress,
        shipped_at: trackingId ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create sample shipment", { pitchId, error: error.message });
      throw ApiError.internal("Failed to create sample shipment");
    }

    logger.info("Sample shipment saved to DB", { pitchId, displayTrackingId, awbCode, shiprocketOrderId });
    return toShipment(shipmentRow as ShipmentRow);
  }

  /**
   * Get live tracking info from Shiprocket for a shipment.
   * Uses awb_code if available, otherwise falls back to DB status.
   */
  async trackShipment(shipmentId: string): Promise<{
    status: string;
    currentLocation?: string;
    lastUpdated?: string;
    trackingId: string;
    awbCode: string | null;
    shiprocketShipmentId: string | null;
  }> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("tracking_id, awb_code, shiprocket_shipment_id, status")
      .eq("id", shipmentId)
      .single();

    if (error || !data) throw ApiError.notFound("Shipment not found");

    const row = data as { tracking_id: string; awb_code: string | null; shiprocket_shipment_id: string | null; status: string };
    const awbCode = row.awb_code;
    const trackingId = row.tracking_id;

    // If we have a real AWB, get live tracking from Shiprocket
    if (awbCode && !awbCode.startsWith("TRK-PENDING") && !awbCode.startsWith("RTN-") && !awbCode.startsWith("SAMPLE-")) {
      try {
        const live = await shiprocketClient.trackShipment(awbCode);
        return { ...live, trackingId, awbCode, shiprocketShipmentId: row.shiprocket_shipment_id };
      } catch {
        // fall through to DB status
      }
    }

    return {
      status: row.status,
      trackingId,
      awbCode,
      shiprocketShipmentId: row.shiprocket_shipment_id,
    };
  }

  /**
   * Update AWB code for a shipment after courier assignment (post-KYC).
   */
  async updateAwbCode(shipmentId: string, awbCode: string): Promise<Shipment> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .update({ awb_code: awbCode, tracking_id: awbCode })
      .eq("id", shipmentId)
      .select()
      .single();

    if (error || !data) throw ApiError.notFound("Shipment not found");
    logger.info("AWB code updated", { shipmentId, awbCode });
    return toShipment(data as ShipmentRow);
  }

  /**
   * Handle Shiprocket webhook event — update shipment and order status.
   */
  async handleShiprocketWebhook(payload: Record<string, unknown>): Promise<void> {
    const awb = payload.awb as string | undefined;
    const status = payload.current_status as string | undefined;
    const shiprocketOrderId = typeof payload.order_id === "string" || typeof payload.order_id === "number"
      ? String(payload.order_id)
      : "";

    if (!awb && !shiprocketOrderId) {
      logger.warn("Shiprocket webhook missing awb and order_id", { payload });
      return;
    }

    // Map Shiprocket status → our internal status
    const statusMap: Record<string, ShipmentStatus> = {
      "Shipped": "SHIPPED",
      "In Transit": "SHIPPED",
      "Out For Delivery": "OUT_FOR_DELIVERY",
      "Delivered": "DELIVERED",
      "RTO Initiated": "RTO",
      "RTO Delivered": "RTO",
      "Returned": "RETURNED",
      "Cancelled": "RETURNED",
    };

    const internalStatus: ShipmentStatus | undefined = status ? statusMap[status] : undefined;
    if (!internalStatus) {
      logger.info("Shiprocket webhook status not mapped, skipping", { status });
      return;
    }

    // Find shipment by AWB or shiprocket_order_id
    let query = supabaseAdmin.from("shipments").select("id, order_id, status");
    if (awb) {
      query = query.eq("awb_code", awb) as typeof query;
    } else {
      query = query.eq("shiprocket_order_id", shiprocketOrderId) as typeof query;
    }

    const { data: rows } = await query.limit(1);
    const shipmentRow = rows?.[0] as { id: string; order_id: string | null; status: string } | undefined;

    if (!shipmentRow) {
      logger.warn("Shiprocket webhook: shipment not found", { awb, shiprocketOrderId });
      return;
    }

    // Don't regress status
    const statusOrder: ShipmentStatus[] = ["PENDING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "RTO"];
    const currentIdx = statusOrder.indexOf(shipmentRow.status as ShipmentStatus);
    const newIdx = statusOrder.indexOf(internalStatus);
    if (newIdx <= currentIdx) {
      logger.info("Shiprocket webhook: status not advanced, skipping", { current: shipmentRow.status, new: internalStatus });
      return;
    }

    await this.updateShipmentStatus(shipmentRow.id, internalStatus);
    logger.info("Shiprocket webhook processed", { shipmentId: shipmentRow.id, status: internalStatus });
  }

  /**
   * Get the sample shipment for a pitch (brand → expert delivery).
   */
  async getShipmentByPitchId(pitchId: string): Promise<Shipment | null> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("pitch_id", pitchId)
      .eq("type", "SAMPLE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch shipment for pitch", { pitchId, error: error.message });
      throw ApiError.internal("Failed to fetch shipment");
    }

    return data ? toShipment(data as ShipmentRow) : null;
  }

  /**
   * Get shipment by order ID (returns the latest one).
   */
  async getShipmentByOrderId(orderId: string): Promise<Shipment | null> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch shipment", { orderId, error: error.message });
      throw ApiError.internal("Failed to fetch shipment");
    }

    return data ? toShipment(data as ShipmentRow) : null;
  }
}

export const logisticsService = new LogisticsService();

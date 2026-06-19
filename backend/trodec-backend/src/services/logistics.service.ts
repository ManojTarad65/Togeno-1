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
  invoice_url: string | null;
  manifest_url: string | null;
  carrier: string;
  type: ShipmentType;
  status: ShipmentStatus;
  from_address: Record<string, unknown>;
  to_address: Record<string, unknown>;
  tracking_events: TrackingEvent[] | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackingEvent {
  status: string;
  label: string;
  location: string;
  timestamp: string;
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
  invoiceUrl: string | null;
  manifestUrl: string | null;
  carrier: string;
  type: ShipmentType;
  status: ShipmentStatus;
  fromAddress: Record<string, unknown>;
  toAddress: Record<string, unknown>;
  trackingEvents: TrackingEvent[] | null;
  estimatedDelivery: string | null;
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
    invoiceUrl: row.invoice_url ?? null,
    manifestUrl: row.manifest_url ?? null,
    carrier: row.carrier,
    type: row.type,
    status: row.status,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    trackingEvents: row.tracking_events ?? null,
    estimatedDelivery: row.estimated_delivery ?? null,
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
// Canonical status mapper (mirrors EV-charger project)
// ---------------------------------------------------------------------------

export type CanonicalShipmentStatus =
  | "pending"
  | "order_placed"
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** Map a raw Shiprocket status string to a canonical internal stage. */
export function mapShiprocketStatus(raw: string): CanonicalShipmentStatus {
  const s = (raw || "").toUpperCase();
  if (s.includes("DELIVERED")) return "delivered";
  if (s.includes("OUT FOR DELIVERY")) return "out_for_delivery";
  if (s.includes("IN TRANSIT") || s.includes("RTO")) return "in_transit";
  if (s.includes("SHIPPED") || s.includes("PICKED") || s.includes("PICKUP")) return "shipped";
  if (s.includes("CANCEL")) return "cancelled";
  if (s.includes("READY") || s.includes("MANIFEST") || s.includes("PACK")) return "ready_to_ship";
  if (s.includes("NEW") || s.includes("PROCESS") || s.includes("AWB")) return "processing";
  return "order_placed";
}

// ---------------------------------------------------------------------------
// Shiprocket API client
// ---------------------------------------------------------------------------

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
// Shiprocket tokens are valid for ~10 days; refresh one day early
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;

class ShiprocketClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private async getToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.token && Date.now() < this.tokenExpiry) {
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
    this.tokenExpiry = Date.now() + TOKEN_TTL_MS;
    logger.info("Shiprocket token refreshed");
    return this.token;
  }

  private async post<T>(path: string, body: Record<string, unknown>, retry = true): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${SHIPROCKET_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401 && retry) {
      await this.getToken(true);
      return this.post<T>(path, body, false);
    }

    const json = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      logger.error("Shiprocket API error", { path, status: res.status, message: (json as any).message, body });
      throw ApiError.internal((json as any).message ?? "Shiprocket request failed");
    }
    return json;
  }

  private async get<T>(path: string, retry = true): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${SHIPROCKET_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 && retry) {
      await this.getToken(true);
      return this.get<T>(path, false);
    }

    const json = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      logger.error("Shiprocket API error", { path, status: res.status });
      throw ApiError.internal((json as any).message ?? "Shiprocket request failed");
    }
    return json;
  }

  // -------------------------------------------------------------------------
  // Order creation
  // -------------------------------------------------------------------------

  async createForwardOrder(params: {
    internalOrderId: string;
    orderDate: string;
    from: ShiprocketAddress;
    to: ShiprocketAddress;
    items: ShiprocketOrderItem[];
    totalAmount: number;
    paymentMethod?: "prepaid" | "COD";
    pickupLocation?: string;
    weight?: number;
    length?: number;
    breadth?: number;
    height?: number;
  }): Promise<{
    shiprocketOrderId: string;
    shiprocketShipmentId: string;
    trackingId: string;
    courier: string;
    freightCharge: number | null;
    courierCompanyId: number | null;
  }> {
    const {
      internalOrderId, orderDate, to, items, totalAmount,
      paymentMethod = "prepaid", pickupLocation = "Primary",
      weight = 0.5, length = 10, breadth = 10, height = 10,
    } = params;

    const sanitizedPhone = (to.phone ?? "").replace(/\D/g, "").slice(-10);

    const body = {
      order_id: internalOrderId,
      order_date: orderDate,
      pickup_location: pickupLocation,
      channel_id: "",
      comment: "Trodec Order",
      billing_customer_name: (to.name ?? "").trim(),
      billing_last_name: ".",
      billing_address: (to.line1 ?? "").trim(),
      billing_address_2: (to.line2 ?? "").trim(),
      billing_city: (to.city ?? "").trim(),
      billing_pincode: (to.postalCode ?? "").trim(),
      billing_state: (to.state ?? "").trim(),
      billing_country: (to.country || "India").trim(),
      billing_email: "orders@trodec.in",
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
      length,
      breadth,
      height,
      weight,
    };

    const resp = await this.post<{
      order_id: number;
      shipment_id: number;
      awb_code?: string;
      courier_name?: string;
      status: string;
    }>("/orders/create/adhoc", body as Record<string, unknown>);

    if (!resp.order_id) {
      throw new Error(
        `Shiprocket order creation returned no order_id — pickup location may be unregistered. Response: ${JSON.stringify(resp)}`
      );
    }

    let awb = resp.awb_code ?? "";
    let courier = resp.courier_name ?? "Shiprocket";
    let freightCharge: number | null = null;
    let courierCompanyId: number | null = null;

    if (!awb && resp.shipment_id) {
      try {
        const awbResult = await this.assignCourier(resp.shipment_id);
        awb = awbResult.awbCode;
        courier = awbResult.courierName ?? courier;
        freightCharge = awbResult.freightCharge;
        courierCompanyId = awbResult.courierCompanyId;
      } catch (err: any) {
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
      freightCharge,
      courierCompanyId,
    };
  }

  // -------------------------------------------------------------------------
  // AWB assignment
  // -------------------------------------------------------------------------

  async assignCourier(shipmentId: number): Promise<{
    awbCode: string;
    courierName: string | null;
    courierCompanyId: number | null;
    freightCharge: number | null;
  }> {
    const resp = await this.post<{
      response?: {
        data?: {
          awb_code?: string;
          courier_name?: string;
          courier_company_id?: number;
          freight_charge?: number | string;
          rate?: number | string;
          awb_assign_error?: string;
        };
      };
    }>("/courier/assign/awb", { shipment_id: String(shipmentId) } as Record<string, unknown>);

    const d = resp.response?.data;
    const awb = d?.awb_code ?? "";
    if (!awb) {
      const reason = d?.awb_assign_error || "No AWB returned by Shiprocket.";
      throw new Error(reason);
    }

    const rawFreight = d?.freight_charge ?? d?.rate;
    const freight = rawFreight != null && rawFreight !== "" ? Number(rawFreight) : NaN;

    return {
      awbCode: awb,
      courierName: d?.courier_name ?? null,
      courierCompanyId: d?.courier_company_id ?? null,
      freightCharge: Number.isFinite(freight) ? freight : null,
    };
  }

  // -------------------------------------------------------------------------
  // Label, Invoice, Manifest
  // -------------------------------------------------------------------------

  /** Generate shipping label — uses the correct /courier/generate/label endpoint. */
  async generateLabel(shiprocketShipmentId: string): Promise<string | null> {
    try {
      const resp = await this.post<{ label_created?: number; label_url?: string }>(
        "/courier/generate/label",
        { shipment_id: [Number(shiprocketShipmentId)] } as Record<string, unknown>,
      );
      logger.info("Shiprocket label response", { shiprocketShipmentId, resp: JSON.stringify(resp) });
      const url = resp.label_url ?? null;
      return url && url.length > 0 ? url : null;
    } catch (err) {
      logger.warn("Shiprocket label generation failed", { shiprocketShipmentId, err });
      return null;
    }
  }

  /** Generate invoice PDF for a Shiprocket order. */
  async generateInvoice(shiprocketOrderId: string): Promise<string | null> {
    try {
      const resp = await this.post<{ is_invoice_created?: boolean; invoice_url?: string }>(
        "/orders/print/invoice",
        { ids: [Number(shiprocketOrderId)] } as Record<string, unknown>,
      );
      return resp.invoice_url ?? null;
    } catch (err) {
      logger.warn("Shiprocket invoice generation failed", { shiprocketOrderId, err });
      return null;
    }
  }

  /** Generate manifest PDF. Falls back to /manifests/print if primary call returns no URL. */
  async generateManifest(shiprocketShipmentId: string): Promise<string | null> {
    try {
      const gen = await this.post<{ status?: number; manifest_url?: string }>(
        "/manifests/generate",
        { shipment_id: [Number(shiprocketShipmentId)] } as Record<string, unknown>,
      );
      if (gen.manifest_url) return gen.manifest_url;

      const printed = await this.post<{ manifest_url?: string }>(
        "/manifests/print",
        { order_ids: [Number(shiprocketShipmentId)] } as Record<string, unknown>,
      );
      return printed.manifest_url ?? null;
    } catch (err) {
      logger.warn("Shiprocket manifest generation failed", { shiprocketShipmentId, err });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Serviceability / freight calculation
  // -------------------------------------------------------------------------

  /**
   * Calculate the actual courier freight for a route via the serviceability API.
   * Prefers the assigned courier (by id, then name); falls back to recommended/cheapest.
   */
  async getFreightCharge(opts: {
    pickupPincode: string;
    deliveryPincode: string;
    weight: number;
    courierCompanyId?: number | null;
    courierName?: string | null;
  }): Promise<number | null> {
    if (!opts.pickupPincode || !opts.deliveryPincode) return null;
    try {
      const qs = new URLSearchParams({
        pickup_postcode: opts.pickupPincode,
        delivery_postcode: opts.deliveryPincode,
        weight: String(opts.weight || 0.5),
        cod: "0",
      });
      const data = await this.get<{
        data?: {
          available_courier_companies?: Array<{
            courier_company_id?: number;
            courier_name?: string;
            freight_charge?: number | string;
            rate?: number | string;
            is_recommended?: number;
          }>;
        };
      }>(`/courier/serviceability/?${qs.toString()}`);

      const list = data.data?.available_courier_companies ?? [];
      if (!list.length) return null;

      const byId   = opts.courierCompanyId ? list.find((c) => c.courier_company_id === opts.courierCompanyId) : undefined;
      const byName = opts.courierName ? list.find((c) => (c.courier_name || "").toLowerCase() === opts.courierName!.toLowerCase()) : undefined;
      const recommended = list.find((c) => c.is_recommended === 1);
      const chosen = byId ?? byName ?? recommended ?? list[0];

      const raw = chosen.freight_charge ?? chosen.rate;
      const n = raw != null && raw !== "" ? Number(raw) : NaN;
      return Number.isFinite(n) ? n : null;
    } catch (err) {
      logger.warn("Shiprocket serviceability lookup failed", { opts, err });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Pickup location pincode resolution (cached per process lifetime)
  // -------------------------------------------------------------------------

  private pickupPincodeCache = new Map<string, string | null>();

  async getPickupPincode(nickname: string): Promise<string | null> {
    if (this.pickupPincodeCache.has(nickname)) return this.pickupPincodeCache.get(nickname) ?? null;
    try {
      const data = await this.get<{
        data?: {
          shipping_address?: Array<{ pickup_location?: string; pin_code?: string | number }>;
        };
      }>("/settings/company/pickup");
      const loc = data.data?.shipping_address?.find((l) => l.pickup_location === nickname);
      const pin = loc?.pin_code != null ? String(loc.pin_code) : null;
      this.pickupPincodeCache.set(nickname, pin);
      return pin;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Idempotency: recover an existing Shiprocket order by our internal order number
  // -------------------------------------------------------------------------

  async findShiprocketOrderByNumber(orderNumber: string): Promise<{
    shiprocketOrderId: string;
    shiprocketShipmentId: string;
    awbCode: string | null;
    courierName: string | null;
    courierCompanyId: number | null;
    freightCharge: number | null;
  } | null> {
    type Row = {
      id: number;
      channel_order_id: string;
      status?: string;
      shipments?: Array<{
        id: number;
        awb?: string;
        courier?: string;
        courier_id?: number;
        shipping_charges?: number | string;
      }>;
    };

    const pick = (rows: Row[]) => rows.find((o) => o.channel_order_id === orderNumber) ?? null;

    let match: Row | null = null;
    try {
      const searched = await this.get<{ data?: Row[] }>(
        `/orders?per_page=50&search=${encodeURIComponent(orderNumber)}`
      );
      match = pick(searched.data ?? []);
    } catch { /* fall through */ }

    if (!match) {
      try {
        const recent = await this.get<{ data?: Row[] }>("/orders?per_page=50");
        match = pick(recent.data ?? []);
      } catch { return null; }
    }
    if (!match) return null;

    const sh = match.shipments?.[0];
    const sc = sh?.shipping_charges;
    const scNum = sc != null && sc !== "" ? Number(sc) : NaN;

    return {
      shiprocketOrderId: String(match.id),
      shiprocketShipmentId: sh ? String(sh.id) : "",
      awbCode: sh?.awb ? String(sh.awb) : null,
      courierName: sh?.courier ? String(sh.courier) : null,
      courierCompanyId: sh?.courier_id ?? null,
      freightCharge: Number.isFinite(scNum) && scNum > 0 ? scNum : null,
    };
  }

  // -------------------------------------------------------------------------
  // Label fallback: fetch from order details
  // -------------------------------------------------------------------------

  async getLabelFromOrderDetails(shiprocketOrderId: string): Promise<string | null> {
    try {
      const resp = await this.get<Record<string, unknown>>(`/orders/show/${shiprocketOrderId}`);
      logger.info("Shiprocket order details response", { shiprocketOrderId, resp: JSON.stringify(resp) });

      const data = (resp as any)?.data ?? resp;
      const shipments: unknown[] = data?.shipments ?? data?.shipment ?? [];
      for (const s of shipments) {
        const label = (s as any)?.label ?? (s as any)?.label_url ?? (s as any)?.awb_label_url;
        if (label && typeof label === "string" && label.startsWith("http")) return label;
      }
      const topLevel = (resp as any)?.label_url ?? (resp as any)?.label ?? (data as any)?.label_url;
      if (topLevel && typeof topLevel === "string" && topLevel.startsWith("http")) return topLevel;
      return null;
    } catch (err) {
      logger.warn("Shiprocket order details fetch failed", { shiprocketOrderId, err });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Tracking
  // -------------------------------------------------------------------------

  async trackShipment(awb: string): Promise<{
    status: string;
    canonicalStatus: CanonicalShipmentStatus;
    currentLocation?: string;
    lastUpdated?: string;
    estimatedDelivery?: string | null;
    events: TrackingEvent[];
    courierName: string | null;
  }> {
    const resp = await this.get<{
      tracking_data?: {
        shipment_status?: number;
        shipment_track?: Array<{
          current_status?: string;
          courier_name?: string;
          edd?: string;
        }>;
        shipment_track_activities?: Array<{
          status?: string;
          activity?: string;
          location?: string;
          date?: string;
        }>;
        etd?: string;
      };
    }>(`/courier/track/awb/${awb}`);

    const td = resp.tracking_data;
    const track = td?.shipment_track?.[0];
    const activities = td?.shipment_track_activities ?? [];

    const events: TrackingEvent[] = activities.map((a) => ({
      status: mapShiprocketStatus(a.status || a.activity || ""),
      label: a.activity || a.status || "Update",
      location: a.location || "",
      timestamp: a.date || "",
    }));

    const rawStatus = track?.current_status || "";

    return {
      status: rawStatus,
      canonicalStatus: mapShiprocketStatus(rawStatus),
      currentLocation: activities[0]?.location,
      lastUpdated: activities[0]?.date,
      estimatedDelivery: track?.edd || td?.etd || null,
      events,
      courierName: track?.courier_name ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Pickup location management
  // -------------------------------------------------------------------------

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
      } as Record<string, unknown>);
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

  async getPickupLocations(): Promise<Array<{ name: string; city: string; status: number }>> {
    const resp = await this.get<{
      data: { shipping_address: Array<{ pickup_location: string; city: string; status: number }> };
    }>("/settings/company/pickup");
    return (resp.data?.shipping_address ?? []).map((l) => ({
      name: l.pickup_location,
      city: l.city,
      status: l.status,
    }));
  }

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

    const derivedName = `trodec-brand-${brandId.replace(/-/g, "").slice(0, 12)}`;
    logger.warn("Brand has no Shiprocket pickup location in DB, using derived name", { brandId, derivedName });
    return derivedName;
  }

  async cancelOrder(shiprocketOrderIds: string[]): Promise<void> {
    await this.post("/orders/cancel", { ids: shiprocketOrderIds } as Record<string, unknown>);
  }
}

export const shiprocketClient = new ShiprocketClient();

// ---------------------------------------------------------------------------
// Logistics Service
// ---------------------------------------------------------------------------

class LogisticsService {
  /**
   * Create a FORWARD shipment after payment is confirmed.
   * Full pipeline: create order → assign AWB → generate label + invoice + manifest.
   * Idempotent: recovers existing Shiprocket orders to avoid duplicates.
   * Actual shipping freight is stored back to orders.actual_shipping_cost.
   */
  async createForwardShipment(params: {
    orderId: string;
    fromAddress: Record<string, unknown>;
    toAddress: Record<string, unknown>;
    items?: ShiprocketOrderItem[];
    totalAmount?: number;
    pickupLocation?: string;
    weight?: number;
    length?: number;
    breadth?: number;
    height?: number;
  }): Promise<Shipment> {
    const {
      orderId, fromAddress, toAddress, items = [],
      totalAmount = 0, pickupLocation,
      weight = 0.5, length = 10, breadth = 10, height = 10,
    } = params;

    let trackingId = "";
    let shiprocketOrderId: string | null = null;
    let shiprocketShipmentId: string | null = null;
    let carrier = "Shiprocket";
    let labelUrl: string | null = null;
    let invoiceUrl: string | null = null;
    let manifestUrl: string | null = null;
    let freightCharge: number | null = null;
    let courierCompanyId: number | null = null;
    let courierName: string | null = null;

    try {
      const to = toAddress as unknown as ShiprocketAddress;

      // Idempotency: recover an existing order to avoid duplicates
      const existing = await shiprocketClient.findShiprocketOrderByNumber(orderId).catch(() => null);
      if (existing) {
        shiprocketOrderId   = existing.shiprocketOrderId;
        shiprocketShipmentId = existing.shiprocketShipmentId;
        trackingId          = existing.awbCode ?? "";
        courierName         = existing.courierName;
        courierCompanyId    = existing.courierCompanyId;
        freightCharge       = existing.freightCharge;
        logger.info("Recovered existing Shiprocket order", { orderId, shiprocketOrderId });
      }

      if (!shiprocketOrderId || !shiprocketShipmentId) {
        const result = await shiprocketClient.createForwardOrder({
          internalOrderId: orderId,
          orderDate: new Date().toISOString().split("T")[0],
          from: fromAddress as unknown as ShiprocketAddress,
          to,
          items: items.length > 0 ? items : [{ name: "Product", sku: "SKU-001", units: 1, selling_price: totalAmount }],
          totalAmount,
          pickupLocation,
          weight,
          length,
          breadth,
          height,
        });

        shiprocketOrderId    = result.shiprocketOrderId;
        shiprocketShipmentId = result.shiprocketShipmentId;
        trackingId           = result.trackingId;
        carrier              = result.courier;
        freightCharge        = result.freightCharge;
        courierCompanyId     = result.courierCompanyId;
        courierName          = result.courier;
        logger.info("Shiprocket forward order created", { orderId, trackingId, shiprocketOrderId });
      }

      // If freight not returned at AWB time, look it up via serviceability API
      if (freightCharge == null && trackingId && pickupLocation) {
        const pickupPincode = await shiprocketClient.getPickupPincode(pickupLocation).catch(() => null);
        const deliveryPincode = (to as any).postalCode ?? "";
        if (pickupPincode && deliveryPincode) {
          freightCharge = await shiprocketClient.getFreightCharge({
            pickupPincode,
            deliveryPincode,
            weight,
            courierCompanyId,
            courierName,
          }).catch(() => null);
        }
      }

      // Store actual_shipping_cost back to orders (never charged to customer, used for brand payout)
      if (freightCharge != null && freightCharge > 0) {
        await supabaseAdmin
          .from("orders")
          .update({ actual_shipping_cost: freightCharge })
          .eq("id", orderId);
        logger.info("Actual shipping cost stored", { orderId, freightCharge });

        // If the order is already delivered and a brand_payout exists with shipping_cost = 0,
        // recalculate it now that we have the real freight charge.
        const { data: orderStatusRow } = await supabaseAdmin
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .single();

        if ((orderStatusRow as any)?.status === "delivered") {
          const { data: existingPayout } = await supabaseAdmin
            .from("brand_payouts")
            .select("id, order_amount, platform_commission, shipping_cost")
            .eq("order_id", orderId)
            .maybeSingle();

          if (existingPayout && Number((existingPayout as any).shipping_cost) === 0) {
            const orderAmount        = Number((existingPayout as any).order_amount);
            const platformCommission = Number((existingPayout as any).platform_commission);
            const newBrandNet        = Math.round((orderAmount - freightCharge - platformCommission) * 100) / 100;

            await supabaseAdmin
              .from("brand_payouts")
              .update({ shipping_cost: freightCharge, brand_net: newBrandNet })
              .eq("id", (existingPayout as any).id);

            logger.info("Brand payout corrected with real freight charge", {
              orderId, freightCharge, newBrandNet,
            });
          }
        }
      }

      // Generate label, invoice, manifest (all best-effort)
      if (shiprocketShipmentId && trackingId && !trackingId.startsWith("TRK-PENDING")) {
        labelUrl = await shiprocketClient.generateLabel(shiprocketShipmentId);
        if (labelUrl) logger.info("Label generated", { orderId, labelUrl });

        invoiceUrl = await shiprocketClient.generateInvoice(shiprocketOrderId!);
        if (invoiceUrl) logger.info("Invoice generated", { orderId, invoiceUrl });

        manifestUrl = await shiprocketClient.generateManifest(shiprocketShipmentId);
        if (manifestUrl) logger.info("Manifest generated", { orderId, manifestUrl });
      }
    } catch (err) {
      logger.error("Shiprocket createForwardOrder failed, using fallback tracking", { orderId, err });
      trackingId = "TRK-PENDING-" + orderId.slice(0, 8).toUpperCase();
    }

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
        invoice_url: invoiceUrl,
        manifest_url: manifestUrl,
        carrier,
        type: "FORWARD",
        status: "PENDING",
        from_address: fromAddress,
        to_address: toAddress,
        shipped_at: null,
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
      .update({ shipment_id: shipment.id })
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
    if (status === "SHIPPED")                            timestamps.shipped_at   = new Date().toISOString();
    if (status === "DELIVERED")                          timestamps.delivered_at = new Date().toISOString();
    if (status === "RETURNED" || status === "RTO")       timestamps.returned_at  = new Date().toISOString();

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

    // FORWARD shipment → sync order status
    if (shipment.orderId) {
      const orderStatusMap: Partial<Record<ShipmentStatus, "shipped" | "delivered" | "cancelled">> = {
        SHIPPED:   "shipped",
        DELIVERED: "delivered",
        RETURNED:  "cancelled",
        RTO:       "cancelled",
      };
      const newOrderStatus = orderStatusMap[status];
      if (newOrderStatus) {
        import("./order.service").then(({ orderService }) =>
          orderService.updateOrderStatus(shipment.orderId!, newOrderStatus).catch((err) =>
            logger.error("Failed to sync order status from shipment webhook", { orderId: shipment.orderId, newOrderStatus, err })
          )
        );
      }
    }

    // SAMPLE shipment → sync pitch status automatically
    // This replaces the manual "Mark Shipped" (brand) and "Confirm Receipt" (expert) buttons
    if (shipment.pitchId && shipment.type === "SAMPLE") {
      const pitchStatusMap: Partial<Record<ShipmentStatus, string>> = {
        SHIPPED:   "shipped",
        DELIVERED: "delivered",
        RETURNED:  "cancelled",
        RTO:       "cancelled",
      };
      const newPitchStatus = pitchStatusMap[status];

      if (newPitchStatus) {
        const pitchUpdate: Record<string, string> = { status: newPitchStatus };
        if (status === "SHIPPED")   pitchUpdate.shipped_at   = new Date().toISOString();
        if (status === "DELIVERED") pitchUpdate.delivered_at = new Date().toISOString();

        supabaseAdmin
          .from("pitches")
          .update(pitchUpdate)
          .eq("id", shipment.pitchId)
          .then(
            () => logger.info("Pitch status auto-synced from SAMPLE shipment", { pitchId: shipment.pitchId, newPitchStatus }),
            (err: unknown) => logger.error("Failed to sync pitch status from shipment", { pitchId: shipment.pitchId, err })
          );
      }
    }

    return shipment;
  }

  /**
   * Cancel the forward shipment on Shiprocket when an order is cancelled.
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
      logger.warn("No forward shipment found at cancellation time", { orderId });
      return;
    }

    if (shipmentRow.shiprocket_order_id) {
      try {
        await shiprocketClient.cancelOrder([shipmentRow.shiprocket_order_id]);
        logger.info("Shiprocket order cancelled", { orderId, shiprocketOrderId: shipmentRow.shiprocket_order_id });
      } catch (err) {
        logger.warn("Shiprocket cancel API failed", { orderId, err });
      }
    }

    await supabaseAdmin
      .from("shipments")
      .update({ status: "RETURNED", returned_at: new Date().toISOString() })
      .eq("id", shipmentRow.id);

    logger.info("Forward shipment marked RETURNED on order cancellation", { orderId });
  }

  /**
   * Create a RETURN shipment — cancels forward on Shiprocket, reverses addresses.
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

    if (forward.shiprocketOrderId) {
      try {
        await shiprocketClient.cancelOrder([forward.shiprocketOrderId]);
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
    let labelUrl: string | null = null;

    try {
      const from = fromAddress as unknown as ShiprocketAddress;
      const to   = toAddress   as unknown as ShiprocketAddress;

      const result = await shiprocketClient.createForwardOrder({
        internalOrderId: `SMP-${pitchId.replace(/-/g, "").slice(0, 16)}`,
        orderDate: new Date().toISOString().split("T")[0],
        from,
        to,
        items: [{ name: "Product Sample", sku: "SAMPLE-001", units: 1, selling_price: 1 }],
        totalAmount: 1,
        pickupLocation,
      });

      shiprocketOrderId    = result.shiprocketOrderId;
      shiprocketShipmentId = result.shiprocketShipmentId;
      trackingId           = result.trackingId;
      carrier              = result.courier;

      if (shiprocketShipmentId && trackingId) {
        labelUrl = await shiprocketClient.generateLabel(shiprocketShipmentId);
      }

      logger.info("Shiprocket sample order created", { pitchId, shiprocketOrderId, awb: trackingId || "pending" });
    } catch (err) {
      logger.error("Shiprocket createSampleShipment failed, using fallback", { pitchId, err });
    }

    const awbCode = trackingId || null;
    const displayTrackingId = trackingId
      || (shiprocketShipmentId ? `SR-${shiprocketShipmentId}` : `SAMPLE-${pitchId.slice(0, 8).toUpperCase()}`);
    // AWB assigned ≠ shipped — status stays PENDING until the carrier webhook fires
    const shipmentStatus: ShipmentStatus = "PENDING";

    const { data: shipmentRow, error } = await supabaseAdmin
      .from("shipments")
      .insert({
        pitch_id: pitchId,
        tracking_id: displayTrackingId,
        shiprocket_order_id: shiprocketOrderId,
        shiprocket_shipment_id: shiprocketShipmentId,
        awb_code: awbCode,
        label_url: labelUrl,
        carrier,
        type: "SAMPLE",
        status: shipmentStatus,
        from_address: fromAddress,
        to_address: toAddress,
        shipped_at: null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create sample shipment", { pitchId, error: error.message });
      throw ApiError.internal("Failed to create sample shipment");
    }

    logger.info("Sample shipment saved to DB", { pitchId, displayTrackingId, awbCode });
    return toShipment(shipmentRow as ShipmentRow);
  }

  /**
   * Get live tracking info and persist full event timeline.
   */
  async trackShipment(shipmentId: string): Promise<{
    status: string;
    canonicalStatus: CanonicalShipmentStatus;
    currentLocation?: string;
    lastUpdated?: string;
    estimatedDelivery?: string | null;
    events: TrackingEvent[];
    courierName: string | null;
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

    const row = data as {
      tracking_id: string;
      awb_code: string | null;
      shiprocket_shipment_id: string | null;
      status: string;
    };
    const awbCode   = row.awb_code;
    const trackingId = row.tracking_id;

    if (awbCode && !awbCode.startsWith("TRK-PENDING") && !awbCode.startsWith("RTN-") && !awbCode.startsWith("SAMPLE-")) {
      try {
        const live = await shiprocketClient.trackShipment(awbCode);

        // Persist events + ETA back to shipment record
        await supabaseAdmin
          .from("shipments")
          .update({
            tracking_events:    live.events.length ? live.events : undefined,
            estimated_delivery: live.estimatedDelivery ?? undefined,
          })
          .eq("id", shipmentId);

        return { ...live, trackingId, awbCode, shiprocketShipmentId: row.shiprocket_shipment_id };
      } catch {
        // fall through to DB status
      }
    }

    return {
      status: row.status,
      canonicalStatus: mapShiprocketStatus(row.status),
      events: [],
      courierName: null,
      trackingId,
      awbCode,
      shiprocketShipmentId: row.shiprocket_shipment_id,
    };
  }

  /**
   * Regenerate and save the shipping label (multi-attempt fallback).
   */
  async refreshLabel(shipmentId: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("shiprocket_shipment_id, shiprocket_order_id, awb_code, label_url, pitch_id, order_id, type, from_address, to_address")
      .eq("id", shipmentId)
      .single();

    if (error || !data) throw ApiError.notFound("Shipment not found");

    const row = data as {
      shiprocket_shipment_id: string | null;
      shiprocket_order_id: string | null;
      awb_code: string | null;
      label_url: string | null;
      pitch_id: string | null;
      order_id: string | null;
      type: string;
      from_address: Record<string, unknown>;
      to_address: Record<string, unknown>;
    };

    logger.info("Refreshing label", { shipmentId, shiprocketShipmentId: row.shiprocket_shipment_id });

    // Step 1: If Shiprocket IDs are missing, try to recover them by searching Shiprocket.
    // This handles the case where the order was created on Shiprocket but our DB save failed.
    if (!row.shiprocket_shipment_id || !row.shiprocket_order_id) {
      const internalOrderId = row.pitch_id
        ? `SMP-${row.pitch_id.replace(/-/g, "").slice(0, 16)}`
        : row.order_id ?? null;

      if (internalOrderId) {
        try {
          const recovered = await shiprocketClient.findShiprocketOrderByNumber(internalOrderId);
          if (recovered) {
            const patch: Record<string, string> = {
              shiprocket_order_id: recovered.shiprocketOrderId,
              shiprocket_shipment_id: recovered.shiprocketShipmentId,
            };
            if (recovered.awbCode) {
              patch.awb_code = recovered.awbCode;
              patch.tracking_id = recovered.awbCode;
            }
            await supabaseAdmin.from("shipments").update(patch).eq("id", shipmentId);
            row.shiprocket_order_id    = recovered.shiprocketOrderId;
            row.shiprocket_shipment_id = recovered.shiprocketShipmentId;
            if (recovered.awbCode) row.awb_code = recovered.awbCode;
            logger.info("Recovered Shiprocket IDs during label refresh", { shipmentId, ...recovered });
          }
        } catch (err) {
          logger.warn("Failed to recover Shiprocket order during label refresh", { shipmentId, err });
        }
      }
    }

    // Step 2: If still no Shiprocket IDs (order never reached Shiprocket), recreate it for SAMPLE shipments.
    if (!row.shiprocket_shipment_id && row.type === "SAMPLE" && row.pitch_id) {
      try {
        const { data: pitchData } = await supabaseAdmin
          .from("pitches")
          .select("brand_id")
          .eq("id", row.pitch_id)
          .single();

        const brandId = (pitchData as any)?.brand_id as string | undefined;
        if (brandId) {
          const { brandService } = await import("./brand.service");
          await brandService.syncPickupLocation(brandId).catch(() => {});
        }
        const pickupLocation = brandId
          ? await shiprocketClient.getBrandPickupLocation(brandId).catch(() => "Primary")
          : "Primary";

        const result = await shiprocketClient.createForwardOrder({
          internalOrderId: `SMP-${row.pitch_id.replace(/-/g, "").slice(0, 16)}`,
          orderDate: new Date().toISOString().split("T")[0],
          from: row.from_address as unknown as Parameters<typeof shiprocketClient.createForwardOrder>[0]["from"],
          to:   row.to_address   as unknown as Parameters<typeof shiprocketClient.createForwardOrder>[0]["to"],
          items: [{ name: "Product Sample", sku: "SAMPLE-001", units: 1, selling_price: 1 }],
          totalAmount: 1,
          pickupLocation,
        });

        const patch: Record<string, string> = {
          shiprocket_order_id:    result.shiprocketOrderId,
          shiprocket_shipment_id: result.shiprocketShipmentId,
        };
        if (result.trackingId) {
          patch.awb_code    = result.trackingId;
          patch.tracking_id = result.trackingId;
        }
        await supabaseAdmin.from("shipments").update(patch).eq("id", shipmentId);
        row.shiprocket_order_id    = result.shiprocketOrderId;
        row.shiprocket_shipment_id = result.shiprocketShipmentId;
        if (result.trackingId) row.awb_code = result.trackingId;
        logger.info("Recreated Shiprocket order during label refresh", { shipmentId, shiprocketOrderId: result.shiprocketOrderId });
      } catch (err) {
        logger.warn("Failed to recreate Shiprocket order during label refresh", { shipmentId, err });
      }
    }

    let labelUrl: string | null = null;

    // Attempt 1: generate label using Shiprocket shipment ID (correct ID for this endpoint)
    if (row.shiprocket_shipment_id) {
      labelUrl = await shiprocketClient.generateLabel(row.shiprocket_shipment_id);
    }
    // Attempt 2: fall back to order details endpoint
    if (!labelUrl && row.shiprocket_order_id) {
      labelUrl = await shiprocketClient.getLabelFromOrderDetails(row.shiprocket_order_id);
    }

    if (!labelUrl) {
      throw ApiError.internal("Label not available yet from Shiprocket. Please try again in a few minutes.");
    }

    await supabaseAdmin
      .from("shipments")
      .update({ label_url: labelUrl })
      .eq("id", shipmentId);

    logger.info("Label refreshed successfully", { shipmentId, labelUrl });
    return labelUrl;
  }

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
   * Handle Shiprocket webhook — update shipment and order status.
   */
  async handleShiprocketWebhook(payload: Record<string, unknown>): Promise<void> {
    const awb             = payload.awb as string | undefined;
    const status          = payload.current_status as string | undefined;
    const shiprocketOrderId = typeof payload.order_id === "string" || typeof payload.order_id === "number"
      ? String(payload.order_id) : "";

    if (!awb && !shiprocketOrderId) {
      logger.warn("Shiprocket webhook missing awb and order_id", { payload });
      return;
    }

    const canonical = status ? mapShiprocketStatus(status) : undefined;
    const statusMap: Partial<Record<CanonicalShipmentStatus, ShipmentStatus>> = {
      shipped:          "SHIPPED",
      in_transit:       "SHIPPED",
      out_for_delivery: "OUT_FOR_DELIVERY",
      delivered:        "DELIVERED",
      cancelled:        "RETURNED",
    };

    const internalStatus = canonical ? statusMap[canonical] : undefined;
    if (!internalStatus) {
      logger.info("Shiprocket webhook status not mapped, skipping", { status });
      return;
    }

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

    const statusOrder: ShipmentStatus[] = ["PENDING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "RTO"];
    const currentIdx = statusOrder.indexOf(shipmentRow.status as ShipmentStatus);
    const newIdx     = statusOrder.indexOf(internalStatus);
    if (newIdx <= currentIdx) {
      logger.info("Shiprocket webhook: status not advanced, skipping", { current: shipmentRow.status, new: internalStatus });
      return;
    }

    await this.updateShipmentStatus(shipmentRow.id, internalStatus);
    logger.info("Shiprocket webhook processed", { shipmentId: shipmentRow.id, status: internalStatus });
  }

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

  /**
   * Retry AWB assignment for a shipment that has no AWB yet.
   * After a successful AWB, also regenerates label + invoice + manifest.
   */
  async retryAwbAndDocuments(shipmentId: string): Promise<{
    awbCode: string | null;
    labelUrl: string | null;
    invoiceUrl: string | null;
    manifestUrl: string | null;
    freightCharge: number | null;
  }> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("id, awb_code, shiprocket_shipment_id, shiprocket_order_id, order_id, label_url, invoice_url, manifest_url")
      .eq("id", shipmentId)
      .single();

    if (error || !data) throw ApiError.notFound("Shipment not found");

    const row = data as {
      awb_code: string | null;
      shiprocket_shipment_id: string | null;
      shiprocket_order_id: string | null;
      order_id: string | null;
      label_url: string | null;
      invoice_url: string | null;
      manifest_url: string | null;
    };

    if (!row.shiprocket_shipment_id) {
      throw ApiError.badRequest("No Shiprocket shipment ID — the order must be created on Shiprocket first.");
    }

    let awbCode = row.awb_code;
    let freightCharge: number | null = null;

    if (!awbCode) {
      const awbResult = await shiprocketClient.assignCourier(Number(row.shiprocket_shipment_id));
      awbCode        = awbResult.awbCode;
      freightCharge  = awbResult.freightCharge;

      await supabaseAdmin
        .from("shipments")
        .update({ awb_code: awbCode, tracking_id: awbCode })
        .eq("id", shipmentId);

      if (freightCharge != null && row.order_id) {
        await supabaseAdmin
          .from("orders")
          .update({ actual_shipping_cost: freightCharge })
          .eq("id", row.order_id);
      }

      logger.info("AWB assigned via retry", { shipmentId, awbCode });
    }

    // Generate all documents now that AWB is available
    return this.retryDocuments(shipmentId);
  }

  /**
   * Regenerate label + invoice + manifest for a shipment that already has an AWB.
   * Only overwrites existing URLs if Shiprocket returns a new one.
   */
  async retryDocuments(shipmentId: string): Promise<{
    awbCode: string | null;
    labelUrl: string | null;
    invoiceUrl: string | null;
    manifestUrl: string | null;
    freightCharge: number | null;
  }> {
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select("id, awb_code, shiprocket_shipment_id, shiprocket_order_id, label_url, invoice_url, manifest_url")
      .eq("id", shipmentId)
      .single();

    if (error || !data) throw ApiError.notFound("Shipment not found");

    const row = data as {
      awb_code: string | null;
      shiprocket_shipment_id: string | null;
      shiprocket_order_id: string | null;
      label_url: string | null;
      invoice_url: string | null;
      manifest_url: string | null;
    };

    if (!row.awb_code) {
      throw ApiError.badRequest("No AWB assigned yet — retry AWB first.");
    }
    if (!row.shiprocket_shipment_id) {
      throw ApiError.badRequest("No Shiprocket shipment ID found.");
    }

    const patch: Record<string, string> = {};
    const results = {
      awbCode:      row.awb_code,
      labelUrl:     row.label_url,
      invoiceUrl:   row.invoice_url,
      manifestUrl:  row.manifest_url,
      freightCharge: null as number | null,
    };

    // Retry label
    const labelUrl = await shiprocketClient.generateLabel(row.shiprocket_shipment_id);
    if (!labelUrl && row.shiprocket_order_id) {
      // Fallback: try order details endpoint
      const fallback = await shiprocketClient.getLabelFromOrderDetails(row.shiprocket_order_id);
      if (fallback) { patch.label_url = fallback; results.labelUrl = fallback; }
    } else if (labelUrl) {
      patch.label_url = labelUrl; results.labelUrl = labelUrl;
    }

    // Retry invoice
    if (row.shiprocket_order_id) {
      const invoiceUrl = await shiprocketClient.generateInvoice(row.shiprocket_order_id);
      if (invoiceUrl) { patch.invoice_url = invoiceUrl; results.invoiceUrl = invoiceUrl; }
    }

    // Retry manifest
    const manifestUrl = await shiprocketClient.generateManifest(row.shiprocket_shipment_id);
    if (manifestUrl) { patch.manifest_url = manifestUrl; results.manifestUrl = manifestUrl; }

    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("shipments").update(patch).eq("id", shipmentId);
      logger.info("Documents retried", { shipmentId, updated: Object.keys(patch) });
    }

    return results;
  }
}

export const logisticsService = new LogisticsService();

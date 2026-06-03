import { supabaseAdmin } from "@/config/supabase";
import { ApiError } from "@/utils/errors";
import { logger } from "@/utils/logger";

export interface InvoiceItem {
  name: string;
  quantity: number;
  selectedSize: string | null;
  price: number;
  subtotal: number;
}

export interface AddressSnapshot {
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal: string;
  country: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  brandId: string;
  orderId: string;
  status: "generated" | "sent" | "downloaded";
  brandName: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  registeredAddress: string | null;
  billingEmail: string | null;
  contactNumber: string | null;
  subtotal: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: InvoiceItem[] | null;
  shippingAddress: AddressSnapshot | null;
  billingAddress: AddressSnapshot | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toInvoice(row: Record<string, any>): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    brandId: row.brand_id,
    orderId: row.order_id,
    status: row.status,
    brandName: row.brand_name,
    gstNumber: row.gst_number,
    panNumber: row.pan_number,
    registeredAddress: row.registered_address,
    billingEmail: row.billing_email,
    contactNumber: row.contact_number,
    subtotal: Number(row.subtotal),
    shippingAmount: Number(row.shipping_amount),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    items: row.items ?? null,
    shippingAddress: row.shipping_address ?? null,
    billingAddress: row.billing_address ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Generate the next invoice number in the format TRD-YYYY-NNNNN
 */
async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { data, error } = await supabaseAdmin.rpc("nextval", {
    sequence_name: "invoice_seq",
  }).single() as any;

  // Fallback: count existing invoices for this year + 1
  let seq = 1;
  if (error || !data) {
    const { count } = await supabaseAdmin
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .like("invoice_number", `TRD-${year}-%`);
    seq = (count ?? 0) + 1;
  } else {
    seq = Number(data);
  }

  return `TRD-${year}-${String(seq).padStart(5, "0")}`;
}

class InvoiceService {
  /**
   * Generate an invoice for a specific order (brand-initiated).
   * Snapshots order + brand billing details at the time of generation.
   */
  async createInvoice(brandId: string, orderId: string): Promise<Invoice> {
    // 1. Load order
    const { data: orderRow, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderError || !orderRow) {
      throw ApiError.notFound("Order not found");
    }

    // Verify order belongs to this brand (via order_items → brand_id)
    const items: any[] = (orderRow as any).order_items ?? [];
    const brandOwnsOrder = items.some((i: any) => i.brand_id === brandId);
    if (!brandOwnsOrder) {
      throw ApiError.forbidden("This order does not belong to your brand");
    }

    // 2. Check for existing invoice (idempotent — one per order per brand)
    const { data: existing } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("brand_id", brandId)
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing) {
      return toInvoice(existing);
    }

    // 3. Load brand billing details
    const { data: brandRow } = await supabaseAdmin
      .from("brand_details")
      .select("brand_name, gst_number, pan_number, registered_address, billing_email, contact_number")
      .eq("id", brandId)
      .maybeSingle();

    // 4. Build item snapshot (only items belonging to this brand)
    const brandItems: InvoiceItem[] = items
      .filter((i: any) => i.brand_id === brandId)
      .map((i: any) => ({
        name: i.product_name,
        quantity: i.quantity,
        selectedSize: i.selected_size ?? null,
        price: Number(i.product_price),
        subtotal: Number(i.subtotal),
      }));

    const subtotal = brandItems.reduce((sum, i) => sum + i.subtotal, 0);
    const shippingAmount = Number((orderRow as any).shipping_amount ?? 0);
    const taxAmount = 0; // Prices include GST
    const totalAmount = subtotal + shippingAmount + taxAmount;

    // 5. Build address snapshots
    const o = orderRow as any;
    const shippingAddress: AddressSnapshot = {
      name: o.shipping_name,
      phone: o.shipping_phone,
      line1: o.shipping_address_line1,
      line2: o.shipping_address_line2 ?? null,
      city: o.shipping_city,
      state: o.shipping_state,
      postal: o.shipping_postal_code,
      country: o.shipping_country,
    };

    // 6. Generate invoice number
    const invoiceNumber = await nextInvoiceNumber();

    // 7. Insert invoice
    const { data: invoiceRow, error: insertError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        brand_id: brandId,
        order_id: orderId,
        status: "generated",
        brand_name: (brandRow as any)?.brand_name ?? null,
        gst_number: (brandRow as any)?.gst_number ?? null,
        pan_number: (brandRow as any)?.pan_number ?? null,
        registered_address: (brandRow as any)?.registered_address ?? null,
        billing_email: (brandRow as any)?.billing_email ?? null,
        contact_number: (brandRow as any)?.contact_number ?? null,
        subtotal,
        shipping_amount: shippingAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        items: brandItems,
        shipping_address: shippingAddress,
        billing_address: shippingAddress, // same for MVP
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to create invoice", { error: insertError.message, brandId, orderId });
      throw ApiError.internal("Failed to create invoice");
    }

    return toInvoice(invoiceRow as Record<string, any>);
  }

  /**
   * List invoices for a brand.
   */
  async listInvoices(brandId: string): Promise<Invoice[]> {
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to list invoices", { error: error.message, brandId });
      throw ApiError.internal("Failed to list invoices");
    }

    return (data ?? []).map(toInvoice);
  }

  /**
   * Get a single invoice.
   */
  async getInvoice(brandId: string, invoiceId: string): Promise<Invoice> {
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("brand_id", brandId)
      .single();

    if (error || !data) {
      throw ApiError.notFound("Invoice not found");
    }

    return toInvoice(data as Record<string, any>);
  }

  /**
   * Mark invoice as downloaded.
   */
  async markDownloaded(brandId: string, invoiceId: string): Promise<void> {
    await supabaseAdmin
      .from("invoices")
      .update({ status: "downloaded", updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("brand_id", brandId);
  }

  /**
   * List fulfilled orders (confirmed/shipped/delivered) for a brand
   * so the brand can select which order to invoice.
   */
  async listInvoiceableOrders(brandId: string): Promise<Array<{
    orderId: string;
    orderNumber: string;
    createdAt: string;
    total: number;
    hasInvoice: boolean;
    status: string;
    customerName: string | null;
  }>> {
    // Find order_items belonging to this brand, then join orders
    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select("order_id, orders!inner(id, order_number, status, total, created_at, shipping_name)")
      .eq("brand_id", brandId)
      .in("orders.status", ["confirmed", "processing", "shipped", "delivered"])
      .order("created_at", { referencedTable: "orders", ascending: false });

    if (error) {
      logger.error("Failed to list invoiceable orders", { error: error.message });
      throw ApiError.internal("Failed to fetch orders");
    }

    // Deduplicate by order_id
    const seen = new Set<string>();
    const orders: Array<{
      orderId: string;
      orderNumber: string;
      createdAt: string;
      total: number;
      hasInvoice: boolean;
      status: string;
      customerName: string | null;
    }> = [];

    for (const row of (items ?? []) as any[]) {
      const o = row.orders;
      if (!o || seen.has(o.id)) continue;
      seen.add(o.id);
      orders.push({
        orderId: o.id,
        orderNumber: o.order_number ?? o.id.slice(0, 8),
        createdAt: o.created_at,
        total: Number(o.total),
        hasInvoice: false,
        status: o.status,
        customerName: o.shipping_name ?? null,
      });
    }

    // Check which orders already have invoices
    if (orders.length > 0) {
      const { data: existingInvoices } = await supabaseAdmin
        .from("invoices")
        .select("order_id")
        .eq("brand_id", brandId)
        .in("order_id", orders.map((o) => o.orderId));

      const invoicedOrderIds = new Set((existingInvoices ?? []).map((i: any) => i.order_id));
      orders.forEach((o) => { o.hasInvoice = invoicedOrderIds.has(o.orderId); });
    }

    return orders;
  }
}

export const invoiceService = new InvoiceService();

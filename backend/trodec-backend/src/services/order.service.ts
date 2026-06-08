import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";
import { productService } from "./product.service";
import { logisticsService, shiprocketClient } from "./logistics.service";
import { commissionService } from "./commission.service";
import { brandPayoutService } from "./brand_payout.service";
import { brandService } from "./brand.service";
import { emailService } from "./email.service";
import { notificationService } from "./notification.service";

// Valid order status transitions — terminal states (delivered, cancelled) have no outbound edges
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:    ["confirmed", "cancelled"],
  confirmed:  ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped:    ["delivered", "cancelled"],
  delivered:  [],
  cancelled:  [],
};

async function resolveBrandPickupLocation(brandId: string): Promise<{ fromAddress: Record<string, unknown>; pickupLocation: string }> {
  const { data: addr } = await supabaseAdmin
    .from("addresses")
    .select("full_name, phone_number, address_line1, address_line2, city, state, postal_code, country")
    .eq("user_id", brandId)
    .eq("is_default_shipping", true)
    .maybeSingle();

  if (!addr) {
    logger.warn("Brand has no default address, falling back to Primary pickup", { brandId });
    return { fromAddress: { name: "Trodec Warehouse", city: "Mumbai", country: "India" }, pickupLocation: "Primary" };
  }

  const fromAddress = {
    name: (addr as any).full_name,
    phone: (addr as any).phone_number,
    line1: (addr as any).address_line1,
    line2: (addr as any).address_line2 ?? "",
    city: (addr as any).city,
    state: (addr as any).state,
    postalCode: (addr as any).postal_code,
    country: (addr as any).country,
  };

  // Ensure pickup location is registered in Shiprocket before creating the order.
  // This is idempotent — safe to call even if already registered.
  await brandService.syncPickupLocation(brandId);

  const pickupLocation = await shiprocketClient.getBrandPickupLocation(brandId);
  return { fromAddress, pickupLocation };
}

// ---------------------------------------------------------------------------
// Types — aligned with actual DB schema
// ---------------------------------------------------------------------------

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  // Denormalized shipping address (stored inline in orders table)
  shippingName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  notes: string | null;
  // Post-based commission attribution
  sourcePostId: string | null;
  expertId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRow {
  id: string;
  user_id: string;
  order_number: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  total: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  notes: string | null;
  source_post_id: string | null;
  expert_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  brandId: string;
  productName: string;
  productPrice: number;
  price: number;
  quantity: number;
  subtotal: number;
  total: number;
  imageUrl: string | null;
  selectedSize: string | null;
  createdAt: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  brand_id: string;
  product_name: string;
  product_price: number;
  product_image_url: string | null;
  quantity: number;
  subtotal: number;
  selected_size: string | null;
  created_at: string;
}

export interface OrderShipmentSummary {
  shipmentId: string;
  awbCode: string | null;
  trackingUrl: string | null;
  carrier: string;
  status: string;
  labelUrl: string | null;
  invoiceUrl: string | null;
  manifestUrl: string | null;
  estimatedDelivery: string | null;
  trackingEvents: Array<{ status: string; label: string; location: string; timestamp: string }> | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  shipment?: OrderShipmentSummary | null;
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    orderNumber: row.order_number,
    status: row.status,
    subtotal: row.subtotal,
    tax: row.tax_amount,
    shippingCost: row.shipping_amount,
    total: row.total,
    shippingName: row.shipping_name,
    shippingPhone: row.shipping_phone,
    shippingAddressLine1: row.shipping_address_line1,
    shippingAddressLine2: row.shipping_address_line2,
    shippingCity: row.shipping_city,
    shippingState: row.shipping_state,
    shippingPostalCode: row.shipping_postal_code,
    shippingCountry: row.shipping_country,
    notes: row.notes,
    sourcePostId: row.source_post_id ?? null,
    expertId: row.expert_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    brandId: row.brand_id,
    productName: row.product_name,
    productPrice: row.product_price,
    price: row.product_price,      // alias expected by frontend
    quantity: row.quantity,
    subtotal: row.subtotal,
    total: row.subtotal,            // alias expected by frontend
    imageUrl: row.product_image_url ?? null,
    selectedSize: row.selected_size ?? null,
    createdAt: row.created_at,
  };
}

interface CartItemInput {
  productId: string;
  quantity: number;
  selectedSize?: string | null;
}

interface CreateOrderData {
  userId: string;
  shippingAddressId: string;
  billingAddressId: string;
  notes?: string | null;
  // Cart items passed directly from frontend (localStorage cart)
  items?: CartItemInput[];
  // Post-based commission attribution
  sourcePostId?: string | null;
  // Optional promo code
  promoCode?: string | null;
}

interface UpdateOrderData {
  notes?: string | null;
}

async function fetchShipmentSummary(orderId: string): Promise<OrderShipmentSummary | null> {
  const { data } = await supabaseAdmin
    .from("shipments")
    .select("id, awb_code, tracking_url, carrier, status, label_url, invoice_url, manifest_url, estimated_delivery, tracking_events, shipped_at, delivered_at")
    .eq("order_id", orderId)
    .eq("type", "FORWARD")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    shipmentId:        (data as any).id,
    awbCode:           (data as any).awb_code ?? null,
    trackingUrl:       (data as any).tracking_url ?? null,
    carrier:           (data as any).carrier ?? "Shiprocket",
    status:            (data as any).status ?? "PENDING",
    labelUrl:          (data as any).label_url ?? null,
    invoiceUrl:        (data as any).invoice_url ?? null,
    manifestUrl:       (data as any).manifest_url ?? null,
    estimatedDelivery: (data as any).estimated_delivery ?? null,
    trackingEvents:    (data as any).tracking_events ?? null,
    shippedAt:         (data as any).shipped_at ?? null,
    deliveredAt:       (data as any).delivered_at ?? null,
  };
}

class OrderService {
  /**
   * Create order from user's cart.
   * Fetches the shipping address to denormalize it into the order row.
   */
  async createOrderFromCart(data: CreateOrderData): Promise<OrderWithItems> {
    const { userId, shippingAddressId, notes, items: inputItems, sourcePostId, promoCode } = data;

    // If ordering from a post, resolve the expert who authored it
    // and verify the consumer is a member of that post's community
    let attributedExpertId: string | null = null;
    if (sourcePostId) {
      const { data: postRow } = await supabaseAdmin
        .from("posts")
        .select("expert_id, community_id")
        .eq("id", sourcePostId)
        .single();

      if (!postRow) {
        throw ApiError.badRequest("Source post not found");
      }

      attributedExpertId = postRow.expert_id ?? null;

      // Consumer must be a member of the community the post belongs to
      const { data: membership } = await supabaseAdmin
        .from("community_members")
        .select("id")
        .eq("community_id", postRow.community_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!membership) {
        throw ApiError.forbidden("You must join this community before ordering from its reviews");
      }
    }

    // Auto-attribute to expert when no sourcePostId was passed (e.g. checkout from cart or product page).
    // Find the most recent published post for any product in the cart and attribute to that expert.
    if (!attributedExpertId && !sourcePostId) {
      const cartProductIds = (inputItems ?? []).map((i) => i.productId).filter(Boolean);
      if (cartProductIds.length > 0) {
        const { data: postRows } = await supabaseAdmin
          .from("posts")
          .select("expert_id, product_id")
          .in("product_id", cartProductIds)
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(10);

        if (postRows && postRows.length > 0) {
          // Pick the expert with the most products reviewed in this order
          const counts: Record<string, number> = {};
          for (const p of postRows) {
            if (p.expert_id) counts[p.expert_id] = (counts[p.expert_id] ?? 0) + 1;
          }
          const topExpert = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          if (topExpert) attributedExpertId = topExpert[0];
        }
      }
    }

    // Fetch shipping address to denormalize into order
    const { data: addrRow, error: addrError } = await supabaseAdmin
      .from("addresses")
      .select("*")
      .eq("id", shippingAddressId)
      .eq("user_id", userId)
      .single();

    if (addrError || !addrRow) {
      throw ApiError.badRequest("Shipping address not found");
    }

    // Resolve cart items — prefer items passed from frontend (localStorage cart),
    // fall back to Supabase cart_items table
    let resolvedItems: CartItemInput[];
    if (inputItems && inputItems.length > 0) {
      resolvedItems = inputItems;
    } else {
      const dbCart = await productService.getCartItems(userId);
      if (dbCart.length === 0) throw ApiError.badRequest("Cart is empty");
      resolvedItems = dbCart.map((c) => ({ productId: c.productId, quantity: c.quantity, selectedSize: c.selectedSize }));
    }

    // Validate each product and build order items
    let subtotal = 0;
    const orderItems: Array<{
      product_id: string;
      brand_id: string;
      product_name: string;
      product_image_url: string | null;
      product_price: number;
      quantity: number;
      subtotal: number;
      selected_size: string | null;
    }> = [];

    for (const item of resolvedItems) {
      const product = await productService.getProduct(item.productId);
      if (!product) throw ApiError.badRequest(`Product ${item.productId} not found`);
      if (product.status !== "active") throw ApiError.badRequest(`Product ${product.name} is not available`);
      if (product.stockQuantity < item.quantity) throw ApiError.badRequest(`Insufficient stock for ${product.name}`);

      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;

      const primaryImage = product.images?.find(img => img.isPrimary) ?? product.images?.[0] ?? null;
      orderItems.push({
        product_id: product.id,
        brand_id: product.brandId,
        product_name: product.name,
        product_image_url: primaryImage?.imageUrl ?? null,
        product_price: product.price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        selected_size: item.selectedSize ?? null,
      });
    }

    const taxAmount = 0;
    // Shipping is always free for customers — actual freight is paid by Trodec
    // and deducted from the brand's net payout after delivery.
    const shippingAmount = 0;

    // Validate and apply promo code discount
    let discountAmount = 0;
    let appliedPromoCode: string | null = null;
    if (promoCode) {
      const { data: promo, error: promoErr } = await supabaseAdmin
        .from("promo_codes")
        .select("id, code, discount_pct, max_uses, used_count, min_order_amount, expires_at")
        .eq("code", promoCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (promoErr || !promo) {
        throw ApiError.badRequest("Invalid or expired promo code");
      }
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        throw ApiError.badRequest("This promo code has expired");
      }
      if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
        throw ApiError.badRequest("This promo code has reached its usage limit");
      }
      if (subtotal < Number(promo.min_order_amount)) {
        throw ApiError.badRequest(`Minimum order amount for this code is ₹${promo.min_order_amount}`);
      }
      // Per-user single-use check
      const { data: alreadyUsed } = await supabaseAdmin
        .from("promo_code_usages")
        .select("id")
        .eq("promo_code_id", promo.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (alreadyUsed) {
        throw ApiError.badRequest("You have already used this promo code");
      }

      discountAmount = Math.round((subtotal * Number(promo.discount_pct)) / 100 * 100) / 100;
      appliedPromoCode = promo.code;
    }

    const total = subtotal + taxAmount + shippingAmount - discountAmount;

    try {
      // 1. Create order with denormalized shipping address
      const { data: orderRow, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          user_id: userId,
          status: "pending",
          subtotal,
          tax_amount: taxAmount,
          shipping_amount: shippingAmount,
          discount_amount: discountAmount,
          promo_code: appliedPromoCode,
          total,
          shipping_name: addrRow.full_name,
          shipping_phone: addrRow.phone_number ?? addrRow.phone,
          shipping_address_line1: addrRow.address_line1,
          shipping_address_line2: addrRow.address_line2 ?? null,
          shipping_city: addrRow.city,
          shipping_state: addrRow.state,
          shipping_postal_code: addrRow.postal_code,
          shipping_country: addrRow.country,
          notes: notes ?? null,
          source_post_id: sourcePostId ?? null,
          expert_id: attributedExpertId,
        })
        .select()
        .single();

      if (orderError) {
        logger.error("Failed to create order", { error: orderError.message });
        throw ApiError.internal("Failed to create order");
      }

      const order = toOrder(orderRow as OrderRow);

      // 2. Create order items
      const orderItemsWithId = orderItems.map((item) => ({ ...item, order_id: order.id }));

      const { data: itemsData, error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(orderItemsWithId)
        .select();

      if (itemsError) {
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        logger.error("Failed to create order items", { error: itemsError.message });
        throw ApiError.internal("Failed to create order items");
      }

      // 3. Update product stock for each ordered item
      for (const item of orderItems) {
        const product = await productService.getProduct(item.product_id);
        if (product) {
          await supabaseAdmin
            .from("products")
            .update({ stock_quantity: product.stockQuantity - item.quantity })
            .eq("id", item.product_id);
        }
      }

      // 4. Clear Supabase cart (no-op if frontend used localStorage cart)
      await productService.clearCart(userId);

      // 5. Record promo code usage + increment used_count
      if (appliedPromoCode) {
        const { data: promo } = await supabaseAdmin
          .from("promo_codes")
          .select("id, used_count")
          .eq("code", appliedPromoCode)
          .single();
        if (promo) {
          // Non-fatal: usage was already validated above; ignore duplicate-key errors
          await supabaseAdmin
            .from("promo_code_usages")
            .insert({ promo_code_id: promo.id, user_id: userId, order_id: order.id });
          await supabaseAdmin
            .from("promo_codes")
            .update({ used_count: (promo as any).used_count + 1 })
            .eq("id", promo.id);
        }
      }

      const createdOrder = {
        ...order,
        items: itemsData?.map((row) => toOrderItem(row as OrderItemRow)) || [],
      };

      // 5. Send order confirmation email (fire-and-forget)
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle();

      if (userProfile?.email) {
        emailService.sendOrderConfirmation({
          to: userProfile.email,
          customerName: userProfile.full_name ?? "Customer",
          orderNumber: order.orderNumber,
          orderTotal: order.total,
          items: createdOrder.items.map((i) => ({
            productName: i.productName,
            quantity: i.quantity,
            subtotal: i.subtotal,
          })),
        }).catch((err) => logger.error("Order confirmation email failed", { orderId: order.id, err }));
      }

      return createdOrder;
    } catch (error) {
      logger.error("Failed to create order from cart", { error, userId });
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, userId?: string): Promise<OrderWithItems | null> {
    let query = supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId);

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      logger.error("Failed to fetch order", { error: error.message, orderId });
      throw ApiError.internal("Failed to fetch order");
    }

    const order = toOrder(data as OrderRow);
    const shipment = await fetchShipmentSummary(order.id);
    return {
      ...order,
      items: data.order_items?.map((item: OrderItemRow) => toOrderItem(item)) || [],
      shipment,
    };
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string, userId?: string): Promise<OrderWithItems | null> {
    let query = supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("order_number", orderNumber);

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null;
      logger.error("Failed to fetch order by number", { error: error.message, orderNumber });
      throw ApiError.internal("Failed to fetch order");
    }

    const order = toOrder(data as OrderRow);
    const shipment = await fetchShipmentSummary(order.id);
    return {
      ...order,
      items: data.order_items?.map((item: OrderItemRow) => toOrderItem(item)) || [],
      shipment,
    };
  }

  /**
   * Get user orders (paginated)
   */
  async getUserOrders(
    userId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("orders")
      .select("*, order_items(*)", { count: "exact" })
      .eq("user_id", userId)
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch user orders", { error: error.message, userId });
      throw ApiError.internal("Failed to fetch orders");
    }

    return {
      data: data?.map((row: any) => ({
        ...toOrder(row as OrderRow),
        items: row.order_items?.map((item: OrderItemRow) => toOrderItem(item)) || [],
      })) || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  /**
   * Update order status.
   * Hooks: DELIVERED → commission; CANCELLED → reverse commission + refund + restore stock; CONFIRMED → forward shipment
   * Validates that the transition is legal before writing.
   */
  async updateOrderStatus(
    orderId: string,
    status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled",
    userId?: string
  ): Promise<Order> {
    // Fetch current status to validate the transition
    const { data: current } = await supabaseAdmin
      .from("orders")
      .select("status, user_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!current) throw ApiError.notFound("Order not found");

    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      throw ApiError.badRequest(
        `Cannot transition order from '${current.status}' to '${status}'`
      );
    }

    let query = supabaseAdmin.from("orders").update({ status }).eq("id", orderId);
    if (userId) query = query.eq("user_id", userId);

    const { data: orderRow, error } = await query.select().single();

    if (error) {
      if (error.code === "PGRST116") throw ApiError.notFound("Order not found");
      logger.error("Failed to update order status", { error: error.message, orderId, status });
      throw ApiError.internal("Failed to update order status");
    }

    const order = toOrder(orderRow as OrderRow);
    const consumerId = (orderRow as any).user_id as string;

    // Fire in-app notification to the consumer for each meaningful status change
    const notifMap: Partial<Record<typeof status, { title: string; message: string }>> = {
      confirmed:  { title: "Order Confirmed", message: `Your order #${order.orderNumber} has been confirmed and is being prepared.` },
      shipped:    { title: "Order Shipped", message: `Your order #${order.orderNumber} is on its way!` },
      delivered:  { title: "Order Delivered", message: `Your order #${order.orderNumber} has been delivered.` },
      cancelled:  { title: "Order Cancelled", message: `Your order #${order.orderNumber} has been cancelled. A refund will be processed if applicable.` },
    };
    const notif = notifMap[status];
    if (notif && consumerId) {
      notificationService.create(consumerId, `order.${status}`, notif.title, notif.message, { orderId, orderNumber: order.orderNumber }).catch(() => {});
    }

    if (status === "shipped") {
      // Send shipped email with tracking info (fire-and-forget)
      (async () => {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("id", consumerId)
          .maybeSingle();
        if (!profile?.email) return;

        const shipment = await fetchShipmentSummary(orderId);
        emailService.sendOrderShipped({
          to: profile.email,
          customerName: profile.full_name ?? "Customer",
          orderNumber: order.orderNumber,
          awbCode: shipment?.awbCode ?? null,
          courierName: shipment?.carrier ?? null,
          trackingUrl: shipment?.trackingUrl ?? null,
          estimatedDelivery: shipment?.estimatedDelivery ?? null,
        }).catch((err) => logger.error("Shipped email failed", { orderId, err }));
      })().catch(() => {});
    }

    if (status === "delivered") {
      // Commission must commit before brand payout reads it — chain, do not fire in parallel.
      commissionService
        .calculateAndStore(orderId, order.subtotal, order.expertId)
        .then(() => brandPayoutService.calculateAndStore(orderId))
        .catch((err) => logger.error("Payout pipeline failed after delivery", { orderId, err }));
    }

    if (status === "cancelled") {
      commissionService.reverse(orderId).catch((err) =>
        logger.error("Commission reversal failed", { orderId, err })
      );
      brandPayoutService.reverse(orderId).catch((err) =>
        logger.error("Brand payout reversal failed", { orderId, err })
      );
      logisticsService.cancelOrderShipment(orderId).catch((err) =>
        logger.error("Shiprocket order cancellation failed", { orderId, err })
      );
      // Lazy import avoids circular dep at module init time (payment.service imports orderService)
      import("./payment.service").then(({ paymentService }) =>
        paymentService.refundPayment(orderId).catch((err) =>
          logger.error("Razorpay refund failed on cancellation", { orderId, err })
        )
      );
      // Restore product stock for all items in the cancelled order
      (async () => {
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", orderId);
        if (!items) return;
        for (const item of items) {
          const { data: p } = await supabaseAdmin
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (p) {
            await supabaseAdmin
              .from("products")
              .update({ stock_quantity: (p as any).stock_quantity + item.quantity })
              .eq("id", item.product_id);
            logger.info("Stock restored for cancelled order item", { orderId, productId: item.product_id });
          }
        }
      })().catch((err) => logger.error("Stock restoration failed on cancellation", { orderId, err }));
    }

    if (status === "confirmed") {
      const toAddress = {
        name: orderRow.shipping_name,
        phone: orderRow.shipping_phone,
        line1: orderRow.shipping_address_line1,
        city: orderRow.shipping_city,
        state: orderRow.shipping_state,
        postalCode: orderRow.shipping_postal_code,
        country: orderRow.shipping_country,
      };
      (async () => {
        logger.info("Starting Shiprocket forward shipment", { orderId });
        const { data: item } = await supabaseAdmin
          .from("order_items")
          .select("brand_id")
          .eq("order_id", orderId)
          .limit(1)
          .maybeSingle();
        logger.info("Resolved brand for shipment", { orderId, brandId: item?.brand_id ?? "none" });
        const { fromAddress, pickupLocation } = await resolveBrandPickupLocation(item?.brand_id ?? "");
        logger.info("Calling createForwardShipment", { orderId, pickupLocation });
        await logisticsService.createForwardShipment({ orderId, fromAddress, toAddress, pickupLocation });
        logger.info("Shiprocket shipment created successfully", { orderId });
      })().catch((err) => logger.error("SHIPROCKET FAILED — forward shipment not created", {
        orderId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }));
    }

    return order;
  }

  /**
   * Cancel order — only allowed from non-terminal, pre-shipped statuses.
   */
  async cancelOrder(orderId: string, userId?: string): Promise<Order> {
    const order = await this.getOrder(orderId, userId);
    if (!order) throw ApiError.notFound("Order not found");
    if (!VALID_TRANSITIONS[order.status]?.includes("cancelled")) {
      throw ApiError.badRequest(`Cannot cancel order with status: ${order.status}`);
    }
    return this.updateOrderStatus(orderId, "cancelled", userId);
  }

  /**
   * Get orders attributed to an expert (via source_post_id → post.expert_id)
   * Used for the Expert Orders Dashboard.
   */
  async getExpertOrders(
    expertId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{ orders: OrderWithItems[]; total: number; stats: { totalOrders: number; totalRevenue: number; topProducts: Array<{ productId: string; productName: string; count: number }> } }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("orders")
      .select("*", { count: "exact" })
      .eq("expert_id", expertId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.status) {
      query = query.eq("status", options.status);
    }

    const { data: orderRows, error, count } = await query;

    if (error) {
      logger.error("Failed to fetch expert orders", { error: error.message, expertId });
      throw ApiError.internal("Failed to fetch expert orders");
    }

    const orders: OrderWithItems[] = await Promise.all(
      (orderRows ?? []).map(async (row) => {
        const order = toOrder(row as OrderRow);
        const { data: itemRows } = await supabaseAdmin
          .from("order_items")
          .select("*")
          .eq("order_id", order.id);

        const items: OrderItem[] = (itemRows ?? []).map((ir) => ({
          id: ir.id,
          orderId: ir.order_id,
          productId: ir.product_id,
          brandId: ir.brand_id,
          productName: ir.product_name,
          productPrice: ir.product_price,
          price: ir.product_price,
          quantity: ir.quantity,
          subtotal: ir.subtotal,
          total: ir.subtotal,
          imageUrl: ir.product_image_url ?? null,
          selectedSize: ir.selected_size ?? null,
          createdAt: ir.created_at,
        }));

        return { ...order, items };
      })
    );

    // Stats: total revenue + top products across ALL expert orders (not paginated)
    const { data: allOrderRows } = await supabaseAdmin
      .from("orders")
      .select("id, total")
      .eq("expert_id", expertId)
      .not("status", "eq", "cancelled");

    const totalRevenue = (allOrderRows ?? []).reduce((sum, o) => sum + Number(o.total), 0);

    const { data: allItemRows } = await supabaseAdmin
      .from("order_items")
      .select("product_id, product_name, quantity")
      .in("order_id", (allOrderRows ?? []).map((o) => o.id));

    const productCounts: Record<string, { productName: string; count: number }> = {};
    for (const item of allItemRows ?? []) {
      if (!productCounts[item.product_id]) {
        productCounts[item.product_id] = { productName: item.product_name, count: 0 };
      }
      productCounts[item.product_id].count += item.quantity;
    }

    const topProducts = Object.entries(productCounts)
      .map(([productId, v]) => ({ productId, productName: v.productName, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      orders,
      total: count ?? 0,
      stats: {
        totalOrders: allOrderRows?.length ?? 0,
        totalRevenue,
        topProducts,
      },
    };
  }

  /**
   * Update order notes (consumers may only update notes, not status).
   */
  async updateOrder(orderId: string, data: UpdateOrderData, userId?: string): Promise<Order> {
    if (data.notes === undefined) throw ApiError.badRequest("No fields to update");

    let query = supabaseAdmin
      .from("orders")
      .update({ notes: data.notes })
      .eq("id", orderId);
    if (userId) query = query.eq("user_id", userId);

    const { data: orderRow, error } = await query.select().single();

    if (error) {
      if (error.code === "PGRST116") throw ApiError.notFound("Order not found");
      logger.error("Failed to update order", { error: error.message, orderId });
      throw ApiError.internal("Failed to update order");
    }

    return toOrder(orderRow as OrderRow);
  }

  /**
   * Consumer confirms they received their order.
   * Only allowed when order is in SHIPPED or OUT_FOR_DELIVERY equivalent status.
   * Transitions to DELIVERED and triggers the payout pipeline.
   *
   * This is the ONLY way a consumer can influence delivered status —
   * the generic PATCH /orders/:id/status is admin-only.
   */
  async confirmReceipt(orderId: string, userId: string): Promise<Order> {
    const order = await this.getOrder(orderId, userId);
    if (!order) throw ApiError.notFound("Order not found");

    // Consumer can only confirm receipt once order has actually been shipped
    const allowedStatuses: string[] = ["shipped", "processing"];
    if (!allowedStatuses.includes(order.status)) {
      throw ApiError.badRequest(
        order.status === "delivered"
          ? "This order has already been marked as delivered"
          : `Cannot confirm receipt for an order with status: ${order.status}`
      );
    }

    // Go through updateOrderStatus so all hooks fire (commission, brand payout)
    return this.updateOrderStatus(orderId, "delivered");
  }
}

export const orderService = new OrderService();

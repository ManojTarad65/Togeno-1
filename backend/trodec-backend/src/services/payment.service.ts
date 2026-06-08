import crypto from "crypto";
import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";
import { env } from "../config/env";
import { orderService } from "./order.service";
import { commissionService } from "./commission.service";
import { brandPayoutService } from "./brand_payout.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentRow {
  id: string;
  order_id: string;
  gateway_id: string | null;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  webhook_event_id: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  orderId: string;
  gatewayId: string | null;
  razorpayOrderId: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
  updatedAt: string;
}

export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    gatewayId: row.gateway_id,
    razorpayOrderId: row.razorpay_order_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Razorpay REST helpers (no SDK dependency — plain fetch)
// We avoid adding an SDK so the existing dependency list stays lean.
// ---------------------------------------------------------------------------

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

function razorpayAuth(): string {
  const key = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

async function razorpayRequest<T>(path: string, method: "POST" | "GET", body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${RAZORPAY_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: razorpayAuth(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as T & { error?: { description?: string } };
  if (!res.ok) {
    throw ApiError.internal(
      (json as { error?: { description?: string } }).error?.description ?? "Razorpay request failed"
    );
  }
  return json;
}

function razorpayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return razorpayRequest<T>(path, "POST", body);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class PaymentService {
  /**
   * Create a Razorpay order and persist a payment record.
   * Called immediately after the DB order is created.
   */
  async initiatePayment(orderId: string, amountInRupees: number): Promise<{
    razorpayOrderId: string;
    amount: number;
    currency: string;
    paymentRecordId: string;
  }> {
    // Amount in paise (Razorpay expects smallest currency unit)
    const amountPaise = Math.round(amountInRupees * 100);

    // Create Razorpay order
    const rzpOrder = await razorpayPost<{ id: string; amount: number; currency: string }>(
      "/orders",
      {
        amount: amountPaise,
        currency: "INR",
        receipt: orderId, // our internal order id as receipt
      }
    );

    // Store razorpay_order_id on the orders row
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({ razorpay_order_id: rzpOrder.id, payment_status: "pending" })
      .eq("id", orderId);

    if (orderUpdateError) {
      logger.error("Failed to save razorpay_order_id on order", { orderId, error: orderUpdateError.message });
      throw ApiError.internal("Failed to update order with payment details");
    }

    // Insert payment record (status = pending)
    const { data: paymentRow, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: orderId,
        razorpay_order_id: rzpOrder.id,
        amount: amountInRupees,
        currency: "INR",
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) {
      logger.error("Failed to insert payment record", { orderId, error: paymentError.message });
      throw ApiError.internal("Failed to create payment record");
    }

    return {
      razorpayOrderId: rzpOrder.id,
      amount: amountInRupees,
      currency: "INR",
      paymentRecordId: paymentRow.id,
    };
  }

  /**
   * Verify Razorpay payment signature after client-side checkout.
   * Returns the updated payment record on success.
   */
  async verifyPayment(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<Payment> {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      throw ApiError.badRequest("Payment signature verification failed");
    }

    // Mark payment as paid
    const { data: paymentRow, error } = await supabaseAdmin
      .from("payments")
      .update({
        gateway_id: razorpayPaymentId,
        status: "paid",
      })
      .eq("razorpay_order_id", razorpayOrderId)
      .eq("order_id", orderId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update payment after verification", { orderId, error: error.message });
      throw ApiError.internal("Failed to update payment status");
    }

    // Stamp payment_status + payment_id on the order
    const { error: stampError } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", payment_id: razorpayPaymentId })
      .eq("id", orderId);

    if (stampError) {
      logger.error("Failed to stamp payment info on order", { orderId, error: stampError.message });
      throw ApiError.internal("Failed to confirm order");
    }

    // Use orderService so the "confirmed" hook fires (triggers forward shipment creation)
    await orderService.updateOrderStatus(orderId, "confirmed");
    logger.info("Order confirmed after payment verification", { orderId });

    return toPayment(paymentRow as PaymentRow);
  }

  /**
   * Handle Razorpay webhook events.
   * Uses webhook_event_id for idempotency — duplicate events are silently ignored.
   */
  async handleWebhook(payload: {
    event: string;
    payload: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
        };
      };
    };
    // Razorpay sends event id in header x-razorpay-event-id
    eventId: string;
    rawBody: string;
    signature: string;
  }): Promise<void> {
    const { event, payload: webhookPayload, eventId, rawBody, signature } = payload;

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSig !== signature) {
      logger.warn("Webhook signature mismatch", { eventId });
      throw ApiError.badRequest("Invalid webhook signature");
    }

    // Idempotency: check if this event was already processed
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("webhook_event_id", eventId)
      .maybeSingle();

    if (existingPayment) {
      // Already processed — return 200 without doing anything
      logger.info("Duplicate webhook event ignored", { eventId });
      return;
    }

    const paymentEntity = webhookPayload.payment?.entity;
    if (!paymentEntity?.order_id) {
      logger.warn("Webhook missing payment entity", { event, eventId });
      return;
    }

    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    if (event === "payment.captured") {
      // Mark payment as paid and stamp webhook_event_id
      await supabaseAdmin
        .from("payments")
        .update({
          gateway_id: razorpayPaymentId,
          status: "paid",
          webhook_event_id: eventId,
          raw_payload: webhookPayload as Record<string, unknown>,
        })
        .eq("razorpay_order_id", razorpayOrderId);

      // Stamp payment info on the order and fetch current status
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: "paid", payment_id: razorpayPaymentId })
        .eq("razorpay_order_id", razorpayOrderId)
        .select("id, status")
        .single();

      if (orderRow) {
        const currentStatus = (orderRow as any).status as string;
        // Fix #5: skip if already past pending — verifyPayment may have beaten the webhook
        if (currentStatus === "pending") {
          await orderService.updateOrderStatus((orderRow as any).id, "confirmed");
          logger.info("Order confirmed via webhook", { orderId: (orderRow as any).id, eventId });
        } else {
          logger.info("Order already past pending, skipping webhook confirm", {
            orderId: (orderRow as any).id, currentStatus, eventId,
          });
        }
      }
    } else if (event === "payment.failed") {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          webhook_event_id: eventId,
          raw_payload: webhookPayload as Record<string, unknown>,
        })
        .eq("razorpay_order_id", razorpayOrderId);

      // Fix #4: auto-cancel the order so stock is restored
      const { data: failedOrderRow } = await supabaseAdmin
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("razorpay_order_id", razorpayOrderId)
        .select("id, status")
        .single();

      if (failedOrderRow && (failedOrderRow as any).status === "pending") {
        orderService.cancelOrder((failedOrderRow as any).id).catch((err) =>
          logger.error("Auto-cancel after payment failure failed", { orderId: (failedOrderRow as any).id, err })
        );
        logger.info("Order auto-cancelled after payment failure", { orderId: (failedOrderRow as any).id, eventId });
      }
    } else if (event === "payment.refunded") {
      const { data: orderRow } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("razorpay_order_id", razorpayOrderId)
        .maybeSingle();

      if (orderRow) {
        const orderId = (orderRow as any).id as string;

        await supabaseAdmin
          .from("payments")
          .update({ status: "refunded", webhook_event_id: eventId, raw_payload: webhookPayload as Record<string, unknown> })
          .eq("razorpay_order_id", razorpayOrderId);

        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "refunded" })
          .eq("id", orderId);

        // Fix #2: reverse both commission AND brand payout on refund
        commissionService.reverse(orderId).catch((err) =>
          logger.error("Commission reversal failed on refund webhook", { orderId, err })
        );
        brandPayoutService.reverse(orderId).catch((err) =>
          logger.error("Brand payout reversal failed on refund webhook", { orderId, err })
        );

        logger.info("Payment refunded via webhook", { razorpayOrderId, eventId, orderId });
      }
    }
  }

  /**
   * Get payment for an order
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch payment", { orderId, error: error.message });
      throw ApiError.internal("Failed to fetch payment");
    }

    return data ? toPayment(data as PaymentRow) : null;
  }

  /**
   * Issue a full Razorpay refund for a paid order.
   * Safe to call on orders that were never paid (no-op).
   * Called automatically when an order is cancelled.
   */
  async refundPayment(orderId: string): Promise<void> {
    const payment = await this.getPaymentByOrderId(orderId);

    // Nothing to refund if the order was never paid
    if (!payment || payment.status !== "paid" || !payment.gatewayId) {
      logger.info("No paid payment found — skipping refund", { orderId });
      return;
    }

    const amountPaise = Math.round(payment.amount * 100);

    // Issue full refund via Razorpay
    const refund = await razorpayPost<{ id: string; amount: number; status: string }>(
      `/payments/${payment.gatewayId}/refund`,
      { amount: amountPaise, speed: "normal" }
    );

    logger.info("Razorpay refund initiated", {
      orderId,
      razorpayPaymentId: payment.gatewayId,
      refundId: refund.id,
      amount: payment.amount,
    });

    // Update payment record
    await supabaseAdmin
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", payment.id);

    // Update order payment_status
    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", orderId);
  }
}

export const paymentService = new PaymentService();

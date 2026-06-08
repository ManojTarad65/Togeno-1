import { Response, NextFunction } from "express";
import { orderService } from "@/services/order.service";
import { ApiError, sendSuccess } from "@/utils";
import { AuthenticatedRequest } from "@/types";

class OrderController {
  /**
   * POST /api/orders
   * Create order from cart
   */
  async createOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const { shippingAddressId, billingAddressId, notes, items, sourcePostId, promoCode } = req.body;

      const order = await orderService.createOrderFromCart({
        userId,
        shippingAddressId,
        billingAddressId,
        notes,
        items,
        sourcePostId,
        promoCode,
      });

      sendSuccess(res, order, 201, "Order created successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders
   * Get user's orders
   */
  async getOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const { page, limit, status } = req.query;

      const result = await orderService.getUserOrders(userId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
      });

      sendSuccess(res, result, 200, "Orders fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/:id
   * Get order by ID
   */
  async getOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;

      const order = await orderService.getOrder(id, userId);
      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      sendSuccess(res, order, 200, "Order fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/orders/number/:orderNumber
   * Get order by order number
   */
  async getOrderByNumber(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const orderNumber = req.params.orderNumber as string;

      const order = await orderService.getOrderByNumber(orderNumber, userId);
      if (!order) {
        throw ApiError.notFound("Order not found");
      }

      sendSuccess(res, order, 200, "Order fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/orders/:id/status
   * Update order status
   */
  async updateOrderStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const { status } = req.body;

      const order = await orderService.updateOrderStatus(id, status, userId);

      sendSuccess(res, order, 200, "Order status updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/orders/:id/cancel
   * Cancel order (consumer — must own the order)
   */
  async cancelOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const order = await orderService.cancelOrder(id, userId);
      sendSuccess(res, order, 200, "Order cancelled successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/orders/:id/brand-cancel
   * Cancel order (brand admin — no user_id ownership filter)
   */
  async brandCancelOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const id = req.params.id as string;
      const order = await orderService.cancelOrder(id);
      sendSuccess(res, order, 200, "Order cancelled successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/orders/:id
   * Update order
   */
  async updateOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const { notes } = req.body;

      const order = await orderService.updateOrder(
        id,
        { notes },
        userId,
      );

      sendSuccess(res, order, 200, "Order updated successfully");
    } catch (error) {
      next(error);
    }
  }
  /**
   * GET /api/orders/expert
   * Get orders attributed to the logged-in expert
   */
  async getExpertOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const expertId = req.user!.id;
      const { page, limit, status } = req.query;

      const result = await orderService.getExpertOrders(expertId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
      });

      sendSuccess(res, result, 200, "Expert orders fetched successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/validate-promo
   * Validate a promo code against the DB and return discount info.
   */
  async validatePromo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { code } = req.body as { code?: string };
      if (!code) throw ApiError.badRequest("Promo code is required");

      const { supabaseAdmin } = await import("@/config/supabase");
      const userId = req.user!.id;

      const { data: promo } = await supabaseAdmin
        .from("promo_codes")
        .select("id, code, discount_pct, max_uses, used_count, min_order_amount, expires_at")
        .eq("code", code.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (!promo) throw ApiError.badRequest("Invalid or expired promo code");
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        throw ApiError.badRequest("This promo code has expired");
      }
      if ((promo as any).max_uses !== null && (promo as any).used_count >= (promo as any).max_uses) {
        throw ApiError.badRequest("This promo code has reached its usage limit");
      }

      const { data: alreadyUsed } = await supabaseAdmin
        .from("promo_code_usages")
        .select("id")
        .eq("promo_code_id", (promo as any).id)
        .eq("user_id", userId)
        .maybeSingle();
      if (alreadyUsed) throw ApiError.badRequest("You have already used this promo code");

      sendSuccess(res, {
        code: (promo as any).code,
        discountPct: Number((promo as any).discount_pct),
        minOrderAmount: Number((promo as any).min_order_amount),
        label: `${(promo as any).discount_pct}% off your order`,
      }, 200, "Promo code valid");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/:id/confirm-receipt
   * Consumer confirms they received their order → marks delivered, triggers payouts.
   */
  async confirmReceipt(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const order = await orderService.confirmReceipt(id, userId);
      sendSuccess(res, order, 200, "Order marked as delivered. Thank you!");
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();

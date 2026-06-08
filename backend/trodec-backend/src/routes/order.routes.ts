import { Router } from "express";
import { orderController } from "@/controllers/order.controller";
import { authenticate, validateBody, validateQuery, requireRole } from "@/middleware";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  updateOrderSchema,
  listOrdersQuerySchema,
} from "@/schemas";

const router = Router();

// =====================================================================
// Static paths — must all come BEFORE /:id to avoid Express shadowing
// =====================================================================

/** POST /orders — create order from cart (any authenticated user) */
router.post("/", authenticate, validateBody(createOrderSchema), orderController.createOrder);

/** GET /orders — list caller's orders */
router.get("/", authenticate, validateQuery(listOrdersQuerySchema), orderController.getOrders);

/** GET /orders/number/:orderNumber */
router.get("/number/:orderNumber", authenticate, orderController.getOrderByNumber);

/** POST /orders/validate-promo */
router.post("/validate-promo", authenticate, orderController.validatePromo);

/** GET /orders/expert/dashboard */
router.get("/expert/dashboard", authenticate, requireRole("expert"), orderController.getExpertOrders);

// =====================================================================
// /:id routes
// =====================================================================

/** GET /orders/:id */
router.get("/:id", authenticate, orderController.getOrder);

/**
 * PATCH /orders/:id/status  — ADMIN ONLY.
 * Consumers must use /confirm-receipt or /cancel.
 */
router.patch(
  "/:id/status",
  authenticate,
  requireRole("admin"),
  validateBody(updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

/**
 * POST /orders/:id/confirm-receipt  — consumer confirms delivery.
 * This is the ONLY path for consumers to trigger the delivered state.
 * Only allowed when order is in 'shipped' or 'processing' status.
 */
router.post("/:id/confirm-receipt", authenticate, orderController.confirmReceipt);

/** POST /orders/:id/cancel — consumer cancels their own order */
router.post("/:id/cancel", authenticate, orderController.cancelOrder);

/** POST /orders/:id/brand-cancel — brand admin cancels an order */
router.post("/:id/brand-cancel", authenticate, requireRole("brand_admin"), orderController.brandCancelOrder);

/**
 * PATCH /orders/:id — update notes only (consumers cannot change status here).
 */
router.patch("/:id", authenticate, validateBody(updateOrderSchema), orderController.updateOrder);

export default router;

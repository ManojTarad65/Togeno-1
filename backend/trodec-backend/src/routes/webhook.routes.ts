import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import { paymentController } from "@/controllers/payment.controller";
import { logisticsController } from "@/controllers/logistics.controller";

const router = Router();

/**
 * POST /api/webhook/razorpay
 *
 * Public endpoint — NO auth middleware.
 * Razorpay posts payment events here.
 * Set this in Razorpay Dashboard → Webhooks:
 *   https://<ngrok-url>/api/webhook/razorpay
 *
 * Uses express.raw() to capture the raw body before any JSON parsing,
 * so we can verify the HMAC-SHA256 signature Razorpay sends in
 * the x-razorpay-signature header.
 */
router.post(
  "/razorpay",
  // Capture raw bytes — do NOT use express.json() on this route
  express.raw({ type: "application/json" }),
  // Attach rawBody string and re-parse JSON for controller access
  (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { rawBody?: string }).rawBody =
      Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body ?? "");
    try {
      req.body = JSON.parse((req as Request & { rawBody?: string }).rawBody ?? "{}");
    } catch {
      req.body = {};
    }
    next();
  },
  paymentController.webhook
);

/**
 * POST /api/webhook/logistics
 *
 * Public endpoint — NO auth middleware.
 * Shiprocket posts shipment status updates here.
 * NOTE: Shiprocket blocks URLs containing "shiprocket", "sr", "kr" — use /logistics instead.
 * Set this in Shiprocket Dashboard → Settings → Additional Settings → Webhooks:
 *   https://api.trodec.in/api/webhook/logistics
 *
 * Shiprocket sends JSON body with current_status, awb, order_id, etc.
 */
router.post("/logistics", logisticsController.shiprocketWebhook);

export default router;

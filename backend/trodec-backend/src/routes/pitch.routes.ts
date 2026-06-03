import { Router } from "express";
import { pitchController } from "@/controllers/pitch.controller";
import {
  authenticate,
  requireRole,
  validateBody,
  validateQuery,
} from "@/middleware";
import {
  createPitchSchema,
  updatePitchSchema,
  respondToPitchSchema,
  listPitchesQuerySchema,
} from "@/schemas/pitch.schema";

const router = Router();

// ============================================
// BRAND ADMIN ROUTES
// ============================================

/**
 * GET /pitches/sent
 * List pitches sent by the brand (brand_admin only)
 */
router.get(
  "/sent",
  authenticate,
  requireRole("brand_admin"),
  validateQuery(listPitchesQuerySchema),
  pitchController.listSentPitches
);

/**
 * POST /pitches
 * Create a new pitch (brand_admin only)
 */
router.post(
  "/",
  authenticate,
  requireRole("brand_admin"),
  validateBody(createPitchSchema),
  pitchController.createPitch
);

/**
 * PATCH /pitches/:id
 * Update pitch (brand_admin only, pending pitches only)
 */
router.patch(
  "/:id",
  authenticate,
  requireRole("brand_admin"),
  validateBody(updatePitchSchema),
  pitchController.updatePitch
);

/**
 * DELETE /pitches/:id
 * Delete pitch (brand_admin only, pending pitches only)
 */
router.delete(
  "/:id",
  authenticate,
  requireRole("brand_admin"),
  pitchController.deletePitch
);

// ============================================
// EXPERT ROUTES
// ============================================

/**
 * GET /pitches/received
 * List pitches received by the expert (expert only)
 */
router.get(
  "/received",
  authenticate,
  requireRole("expert"),
  validateQuery(listPitchesQuerySchema),
  pitchController.listReceivedPitches
);

/**
 * POST /pitches/:id/mark-shipped
 * Brand manually marks sample as shipped (fallback when Shiprocket webhook doesn't fire)
 */
router.post(
  "/:id/mark-shipped",
  authenticate,
  requireRole("brand_admin"),
  pitchController.markShipped
);

/**
 * POST /pitches/:id/respond
 * Expert responds to a pitch (accept or decline)
 */
router.post(
  "/:id/respond",
  authenticate,
  requireRole("expert"),
  validateBody(respondToPitchSchema),
  pitchController.respondToPitch
);

/**
 * POST /pitches/:id/confirm-receipt
 * Expert manually confirms product has been received (marks pitch as delivered)
 */
router.post(
  "/:id/confirm-receipt",
  authenticate,
  requireRole("expert"),
  pitchController.confirmReceipt
);

// ============================================
// SHARED ROUTES (Brand Admin or Expert)
// ============================================

/**
 * GET /pitches/:id/shipment
 * Get the sample shipment (and live tracking) for a pitch.
 */
router.get("/:id/shipment", authenticate, pitchController.getPitchShipment);

/**
 * GET /pitches/:id
 * Get pitch by ID (brand owner or target expert only)
 */
router.get("/:id", authenticate, pitchController.getPitch);

export default router;

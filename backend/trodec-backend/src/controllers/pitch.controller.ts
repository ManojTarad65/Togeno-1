import { Response, NextFunction } from "express";
import { pitchService } from "@/services/pitch.service";
import { logisticsService } from "@/services/logistics.service";
import { sendSuccess } from "@/utils/response";
import { ApiError } from "@/utils/errors";
import { AuthenticatedRequest } from "@/types";
import {
  CreatePitchInput,
  UpdatePitchInput,
  RespondToPitchInput,
  ListPitchesQuery,
} from "@/schemas/pitch.schema";

class PitchController {
  /**
   * POST /pitches
   * Create a new pitch (brand_admin only)
   */
  async createPitch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body as CreatePitchInput;

      const pitch = await pitchService.createPitch({
        brandId: req.user!.id, // brand_admin's user ID is same as brand_details.id
        productId: data.productId,
        communityId: data.communityId,
        expertId: data.expertId,
        message: data.message,
        offerDetails: data.offerDetails,
        requirements: data.requirements,
        postingDeadline: data.postingDeadline,
        sampleType: (data as any).sampleType ?? "KEEP_SAMPLE",
      });

      sendSuccess(res, pitch, 201, "Pitch created successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /pitches/:id
   * Get pitch by ID (brand owner or target expert only)
   */
  async getPitch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const pitchId = Array.isArray(id) ? id[0] : id;

      const pitch = await pitchService.getPitchWithDetails(pitchId);

      if (!pitch) {
        throw ApiError.notFound("Pitch not found");
      }

      // Only brand owner or target expert can view
      const userId = req.user!.id;
      if (pitch.brandId !== userId && pitch.expertId !== userId) {
        throw ApiError.forbidden("You do not have access to this pitch");
      }

      sendSuccess(res, pitch);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /pitches/:id
   * Update pitch (brand_admin only, pending pitches only)
   */
  async updatePitch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const pitchId = Array.isArray(id) ? id[0] : id;
      const data = req.body as UpdatePitchInput;

      const pitch = await pitchService.updatePitch(
        pitchId,
        req.user!.id,
        data
      );

      sendSuccess(res, pitch, 200, "Pitch updated successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /pitches/:id/respond
   * Expert responds to a pitch (accept or decline)
   */
  async respondToPitch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const pitchId = Array.isArray(id) ? id[0] : id;
      const data = req.body as RespondToPitchInput;

      const pitch = await pitchService.respondToPitch(
        pitchId,
        req.user!.id,
        data
      );

      const message =
        data.status === "accepted"
          ? "Pitch accepted successfully"
          : "Pitch declined";

      sendSuccess(res, pitch, 200, message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /pitches/:id
   * Delete pitch (brand_admin only, pending pitches only)
   */
  async deletePitch(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const pitchId = Array.isArray(id) ? id[0] : id;

      await pitchService.deletePitch(pitchId, req.user!.id);

      sendSuccess(res, null, 200, "Pitch deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /pitches/sent
   * List pitches sent by the brand (brand_admin only)
   */
  async listSentPitches(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const typedQuery = query as ListPitchesQuery;

      const result = await pitchService.listBrandPitches(req.user!.id, {
        status: typedQuery.status,
        productId: typedQuery.productId,
        communityId: typedQuery.communityId,
        page: typedQuery.page,
        limit: typedQuery.limit,
        sortBy: typedQuery.sortBy,
        sortOrder: typedQuery.sortOrder,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /pitches/received
   * List pitches received by the expert (expert only)
   */
  async listReceivedPitches(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = (req as any).validatedQuery || req.query;
      const typedQuery = query as ListPitchesQuery;

      const result = await pitchService.listExpertPitches(req.user!.id, {
        status: typedQuery.status,
        communityId: typedQuery.communityId,
        page: typedQuery.page,
        limit: typedQuery.limit,
        sortBy: typedQuery.sortBy,
        sortOrder: typedQuery.sortOrder,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /pitches/:id/confirm-receipt
   * Expert confirms product has been received
   */
  async markShipped(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pitchId = req.params.id as string;
      const pitch = await pitchService.markShipped(pitchId, req.user!.id);
      sendSuccess(res, pitch, 200, "Pitch marked as shipped. The expert will be notified to confirm receipt.");
    } catch (error) {
      next(error);
    }
  }

  async confirmReceipt(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const pitchId = Array.isArray(id) ? id[0] : id;

      const pitch = await pitchService.confirmReceipt(pitchId, req.user!.id);
      sendSuccess(res, pitch, 200, "Product receipt confirmed. You can now publish your review.");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /pitches/:id/shipment
   * Get the sample shipment for a pitch (brand owner or target expert).
   */
  async getPitchShipment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pitchId = req.params.id as string;
      const shipment = await logisticsService.getShipmentByPitchId(pitchId);

      if (!shipment) {
        throw ApiError.notFound("No shipment found for this pitch yet");
      }

      // If there's a real AWB, enrich with live tracking data
      if (shipment.awbCode && !shipment.awbCode.startsWith("SAMPLE-")) {
        const tracking = await logisticsService.trackShipment(shipment.id);
        sendSuccess(res, { ...shipment, liveTracking: tracking });
        return;
      }

      sendSuccess(res, { ...shipment, liveTracking: null });
    } catch (error) {
      next(error);
    }
  }
}

export const pitchController = new PitchController();

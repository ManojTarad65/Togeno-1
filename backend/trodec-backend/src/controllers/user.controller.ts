import { Response, NextFunction } from 'express';
import { userService } from '@/services/user.service';
import { sendSuccess } from '@/utils/response';
import { ApiError } from '@/utils/errors';
import { AuthenticatedRequest } from '@/types';
import {
  UpdateProfileInput,
  UpdateExpertDetailsInput,
  UpdateBrandDetailsInput,
  ListUsersQuery,
} from '@/schemas';

class UserController {
  /**
   * GET /users/me
   * Get current user's full profile (auth handled by middleware)
   */
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userWithProfile = await userService.getUserWithProfile(req.user!);
      sendSuccess(res, userWithProfile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/me
   * Update current user's profile (auth handled by middleware)
   */
  async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as UpdateProfileInput;
      const profile = await userService.updateProfile(req.user!.id, data);
      sendSuccess(res, profile, 200, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/me/expert
   * Get current user's expert details (role check handled by middleware)
   */
  async getMyExpertDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expertDetails = await userService.getExpertDetails(req.user!.id);
      sendSuccess(res, expertDetails);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/me/expert
   * Update current user's expert details (role check handled by middleware)
   */
  async updateMyExpertDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as UpdateExpertDetailsInput;
      const expertDetails = await userService.updateExpertDetails(req.user!.id, data);
      sendSuccess(res, expertDetails, 200, 'Expert details updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/me/brand
   * Get current user's brand details (role check handled by middleware)
   */
  async getMyBrandDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const brandDetails = await userService.getBrandDetails(req.user!.id);
      sendSuccess(res, brandDetails);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/me/brand
   * Update current user's brand details (role check handled by middleware)
   */
  async updateMyBrandDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as UpdateBrandDetailsInput;
      const brandDetails = await userService.updateBrandDetails(req.user!.id, data);
      sendSuccess(res, brandDetails, 200, 'Brand details updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/experts
   * List all experts (public)
   */
  async listExperts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as ListUsersQuery;
      const result = await userService.listExperts({
        verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
        page: query.page,
        limit: query.limit,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/brands
   * List all brands (public)
   */
  async listBrands(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as ListUsersQuery;
      const result = await userService.listBrands({
        verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
        page: query.page,
        limit: query.limit,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/:id/expert-details
   * Public expert details — used by brands to pre-fill size when pitching
   */
  async getExpertDetailsById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const details = await userService.getExpertDetails(req.params.id as string);
      if (!details) throw ApiError.notFound("Expert details not found");
      sendSuccess(res, details);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();

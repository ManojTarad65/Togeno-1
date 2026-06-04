import { Router } from 'express';
import { userController } from '@/controllers/user.controller';
import { communityController } from '@/controllers/community.controller';
import { authenticate, requireRole, validateBody, validateQuery } from '@/middleware';
import {
  updateProfileSchema,
  updateExpertDetailsSchema,
  updateBrandDetailsSchema,
  listUsersQuerySchema,
} from '@/schemas';

const router = Router();

// ============================================
// AUTHENTICATED ROUTES (Current User)
// ============================================

/**
 * GET /users/me
 * Get current user's full profile with role-specific details
 */
router.get('/me', authenticate, userController.getMe);

/**
 * PATCH /users/me
 * Update current user's base profile
 */
router.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  userController.updateMe
);

/**
 * GET /users/me/expert
 * Get current user's expert details (experts only)
 */
router.get('/me/expert', authenticate, requireRole('expert'), userController.getMyExpertDetails);

/**
 * PATCH /users/me/expert
 * Update current user's expert details (experts only)
 */
router.patch(
  '/me/expert',
  authenticate,
  requireRole('expert'),
  validateBody(updateExpertDetailsSchema),
  userController.updateMyExpertDetails
);

/**
 * GET /users/me/brand
 * Get current user's brand details (brand_admin only)
 */
router.get('/me/brand', authenticate, requireRole('brand_admin'), userController.getMyBrandDetails);

/**
 * PATCH /users/me/brand
 * Update current user's brand details (brand_admin only)
 */
router.patch(
  '/me/brand',
  authenticate,
  requireRole('brand_admin'),
  validateBody(updateBrandDetailsSchema),
  userController.updateMyBrandDetails
);

/**
 * GET /users/me/communities
 * Get communities for the current user
 */
router.get('/me/communities', authenticate, communityController.getMyCommunities);

// ============================================
// PUBLIC ROUTES (Listings)
// ============================================

/**
 * GET /users/experts
 * List all experts (public, filterable by verification status)
 */
router.get(
  '/experts',
  validateQuery(listUsersQuerySchema),
  userController.listExperts
);

/**
 * GET /users/brands
 * List all brands (public, filterable by verification status)
 */
router.get(
  '/brands',
  validateQuery(listUsersQuerySchema),
  userController.listBrands
);

/**
 * GET /users/:id/expert-details
 * Get public expert details for a specific user (brand needs this for clothing sizes when pitching)
 */
router.get('/:id/expert-details', userController.getExpertDetailsById);

export default router;

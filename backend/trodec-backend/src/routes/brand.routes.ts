import { Router } from 'express';
import { brandController } from '@/controllers/brand.controller';
import { authenticate, requireRole, validateBody, validateQuery } from '@/middleware';
import {
  createBrandSchema,
  updateBrandSchema,
  listBrandsQuerySchema,
  verifyBrandSchema,
  updatePickupSettingsSchema,
} from '@/schemas';

const router = Router();

// ============================================
// AUTHENTICATED ROUTES (Current User - Brand Admin)
// ============================================

router.get('/me', authenticate, requireRole('brand_admin'), brandController.getMyBrand);
router.post('/me', authenticate, requireRole('brand_admin'), validateBody(createBrandSchema), brandController.createMyBrand);
router.patch('/me', authenticate, requireRole('brand_admin'), validateBody(updateBrandSchema), brandController.updateMyBrand);
router.delete('/me', authenticate, requireRole('brand_admin'), brandController.deleteMyBrand);

router.get('/me/products',        authenticate, requireRole('brand_admin'), brandController.getMyProducts);
router.get('/me/stats',           authenticate, requireRole('brand_admin'), brandController.getMyStats);
router.get('/me/orders',          authenticate, requireRole('brand_admin'), brandController.getMyOrders);
router.get('/me/pickup-settings', authenticate, requireRole('brand_admin'), brandController.getPickupSettings);
router.put('/me/pickup-settings', authenticate, requireRole('brand_admin'), validateBody(updatePickupSettingsSchema), brandController.updatePickupSettings);
router.post('/me/sync-pickup', authenticate, requireRole('brand_admin'), brandController.syncPickupLocation.bind(brandController));
router.get('/me/earnings',        authenticate, requireRole('brand_admin'), brandController.getEarnings);
router.get('/me/bank-accounts',   authenticate, requireRole('brand_admin'), brandController.getBankAccounts);
router.post('/me/bank-accounts',  authenticate, requireRole('brand_admin'), brandController.saveBankAccount);
router.get('/me/withdrawals',     authenticate, requireRole('brand_admin'), brandController.getWithdrawals);
router.post('/me/withdrawals',    authenticate, requireRole('brand_admin'), brandController.requestWithdrawal);

// ============================================
// ADMIN ROUTES — must be before /:id to avoid shadowing
// ============================================

/**
 * GET  /brands/withdrawals          — admin: list all brand withdrawal requests
 * POST /brands/withdrawals/:id/process — admin: approve / pay / reject
 */
router.get(
  '/withdrawals',
  authenticate,
  requireRole('admin'),
  brandController.adminGetWithdrawals,
);

router.post(
  '/withdrawals/:id/process',
  authenticate,
  requireRole('admin'),
  brandController.adminProcessWithdrawal,
);

/**
 * POST /brands/:id/verify  — verify/unverify a brand
 * DELETE /brands/:id       — delete brand
 */
router.post(
  '/:id/verify',
  authenticate,
  requireRole('admin'),
  validateBody(verifyBrandSchema),
  brandController.verifyBrand,
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  brandController.deleteBrand,
);

// ============================================
// PUBLIC ROUTES — /:id must be last
// ============================================

router.get('/', validateQuery(listBrandsQuerySchema), brandController.listBrands);
router.get('/:id', brandController.getBrandById);

export default router;

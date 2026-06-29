import { Router } from 'express';
import multer from 'multer';
import { adminController } from '@/controllers/admin.controller';
import { uploadController } from '@/controllers/upload.controller';
import { logisticsController } from '@/controllers/logistics.controller';
import { authenticate, requireRole } from '@/middleware';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireRole('admin'));

/**
 * GET /admin/stats
 * Get platform-wide statistics
 */
router.get('/stats', adminController.getStats.bind(adminController));

/**
 * GET /admin/users
 * List all users with optional role/search filters
 */
router.get('/users', adminController.listAllUsers.bind(adminController));

/**
 * PATCH /admin/users/:id/active
 * Activate or deactivate a user
 */
router.patch('/users/:id/active', adminController.toggleUserActive.bind(adminController));

/**
 * POST /admin/users/:id/verify
 * Approve or reject an expert or brand
 */
router.post('/users/:id/verify', adminController.verifyUser.bind(adminController));

/**
 * GET /admin/shiprocket/pickup-locations
 * List all pickup locations registered on Shiprocket.
 */
router.get('/shiprocket/pickup-locations', adminController.getShiprocketPickupLocations.bind(adminController));

/**
 * GET /admin/shiprocket/status
 * Diagnose Shiprocket connectivity — token state, cooldown, DB cache.
 */
router.get('/shiprocket/status', adminController.getShiprocketStatus.bind(adminController));

/**
 * GET /admin/brands
 * List all brands
 */
router.get('/brands', adminController.listAllBrands.bind(adminController));

/**
 * GET /admin/brands/pending
 * List brands pending approval
 */
router.get('/brands/pending', adminController.listPendingBrands.bind(adminController));

/**
 * POST /admin/brands/:id/assign-pickup-location
 * Assign a Shiprocket pickup location to a brand.
 */
router.post('/brands/:id/assign-pickup-location', adminController.assignBrandPickupLocation.bind(adminController));

/**
 * GET /admin/experts
 * List all experts
 */
router.get('/experts', adminController.listAllExperts.bind(adminController));

/**
 * GET /admin/experts/pending
 * List experts pending approval
 */
router.get('/experts/pending', adminController.listPendingExperts.bind(adminController));

/**
 * GET /admin/orders
 * List all orders
 */
router.get('/orders', adminController.listAllOrders.bind(adminController));

/**
 * GET /admin/products
 * List all products
 */
router.get('/products', adminController.listAllProducts.bind(adminController));

/**
 * GET /admin/communities
 * List all communities
 */
router.get('/communities', adminController.listAllCommunities.bind(adminController));

/**
 * DELETE /admin/products/:id
 * Delete any product (admin only)
 */
router.delete('/products/:id', adminController.deleteProduct.bind(adminController));

/**
 * PATCH /admin/orders/:id/status
 * Manually update order status (confirmed → ships via Shiprocket, delivered → triggers commission).
 * Used for testing before KYC is complete or for manual overrides.
 */
router.patch('/orders/:id/status', adminController.updateOrderStatus.bind(adminController));

/**
 * POST /admin/orders/:id/create-shipment
 * Manually create a Shiprocket forward shipment for an order whose shipment was
 * never created (e.g. Shiprocket failed silently at payment confirmation).
 */
router.post('/orders/:id/create-shipment', adminController.createShipmentForOrder.bind(adminController));

/**
 * GET /admin/pitches
 * List all pitches with brand/expert/product info.
 */
router.get('/pitches', adminController.listAllPitches.bind(adminController));

/**
 * POST /admin/pitches/:id/create-sample-shipment
 * Manually create (or retry) a Shiprocket sample shipment for a pitch.
 */
router.post('/pitches/:id/create-sample-shipment', adminController.createSampleShipmentForPitch.bind(adminController));

/**
 * GET /admin/shipments
 * List all shipments with order/pitch info and tracking data.
 */
router.get('/shipments', adminController.listAllShipments.bind(adminController));

/**
 * POST /admin/shipments/:id/upload-label
 * Upload a shipping label PDF/image for a shipment.
 */
router.post(
  '/shipments/:id/upload-label',
  upload.single('file'),
  uploadController.uploadShipmentLabel.bind(uploadController)
);

/**
 * POST /admin/shipments/:id/retry-awb
 * Assign AWB if missing, then regenerate label + invoice + manifest.
 */
router.post('/shipments/:id/retry-awb', logisticsController.retryAwb.bind(logisticsController));

/**
 * POST /admin/shipments/:id/retry-documents
 * Regenerate label + invoice + manifest for a shipment that already has an AWB.
 */
router.post('/shipments/:id/retry-documents', logisticsController.retryDocuments.bind(logisticsController));

export default router;

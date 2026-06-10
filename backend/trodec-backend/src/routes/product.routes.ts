import { Router } from "express";
import multer from "multer";
import { productController } from "@/controllers/product.controller";
import { uploadController } from "@/controllers/upload.controller";
import { authenticate, requireRole, requireVerifiedBrand, validateBody, validateQuery } from "@/middleware";

const upload = multer({ storage: multer.memoryStorage() });
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  createProductImageSchema,
  updateProductImageSchema,
  createCartItemSchema,
  updateCartItemSchema,
} from "@/schemas";
import discussionRouter from "./discussion.routes";

const router = Router();

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

/**
 * GET /products
 * List products with pagination and filtering
 */
router.get(
  "/",
  validateQuery(listProductsQuerySchema),
  productController.listProducts
);

/**
 * GET /products/slug/:slug
 * Get product by slug (MUST come before /:id)
 */
router.get("/slug/:slug", productController.getProductBySlug);

/**
 * GET /products/:id
 * Get product by ID
 */
router.get("/:id", productController.getProduct);

/**
 * GET /products/:id/images
 * Get product with images
 */
router.get("/:id/images", productController.getProductWithImages);

/**
 * GET /products/:id/images/list
 * Get product images only
 */
router.get("/:id/images/list", productController.getProductImages);

// ============================================
// AUTHENTICATED ROUTES (Authentication Required)
// ============================================

/**
 * POST /products
 * Create a new product (brand_admin only)
 */
router.post(
  "/",
  authenticate,
  requireVerifiedBrand,
  validateBody(createProductSchema),
  productController.createProduct
);

/**
 * PATCH /products/:id
 * Update product (brand_admin only)
 */
router.patch(
  "/:id",
  authenticate,
  requireRole("brand_admin"),
  validateBody(updateProductSchema),
  productController.updateProduct
);

/**
 * DELETE /products/:id
 * Delete product (soft delete - brand_admin only)
 */
router.delete("/:id", authenticate, requireRole("brand_admin"), productController.deleteProduct);

// ============================================
// PRODUCT IMAGES (Brand Admin Only)
// ============================================

/**
 * POST /products/:id/upload-image
 * Upload a product image file (brand_admin only)
 */
router.post(
  "/:id/upload-image",
  authenticate,
  requireRole("brand_admin"),
  upload.single("file"),
  uploadController.uploadProductImage
);

/**
 * POST /products/:id/images
 * Add product image by URL (brand_admin only)
 */
router.post(
  "/:id/images",
  authenticate,
  requireRole("brand_admin"),
  validateBody(createProductImageSchema),
  productController.addProductImage
);

/**
 * PATCH /products/:productId/images/:imageId
 * Update product image (brand_admin only)
 */
router.patch(
  "/:productId/images/:imageId",
  authenticate,
  requireRole("brand_admin"),
  validateBody(updateProductImageSchema),
  productController.updateProductImage
);

/**
 * DELETE /products/:productId/images/:imageId
 * Delete product image (brand_admin only)
 */
router.delete("/:productId/images/:imageId", authenticate, requireRole("brand_admin"), productController.deleteProductImage);

// ============================================
// CART OPERATIONS (Authenticated Users)
// ============================================

/**
 * POST /cart/items
 * Add item to cart
 */
router.post(
  "/cart/items",
  authenticate,
  validateBody(createCartItemSchema),
  productController.addToCart
);

/**
 * GET /cart/items
 * Get user's cart items
 */
router.get("/cart/items", authenticate, productController.getCartItems);

/**
 * PATCH /cart/items/:productId
 * Update cart item quantity
 */
router.patch(
  "/cart/items/:productId",
  authenticate,
  validateBody(updateCartItemSchema),
  productController.updateCartItemQuantity
);

/**
 * DELETE /cart/items/:productId
 * Remove item from cart
 */
router.delete("/cart/items/:productId", authenticate, productController.removeFromCart);

/**
 * DELETE /cart/items
 * Clear user's cart
 */
router.delete("/cart/items", authenticate, productController.clearCart);

// ============================================
// DISCUSSIONS (nested under product)
// ============================================
router.use("/:productId/discussions", discussionRouter);

export default router;

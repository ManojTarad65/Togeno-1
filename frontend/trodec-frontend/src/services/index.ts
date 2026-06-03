export { default as api, getErrorMessage } from './api';
export type { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from './api';

export * from './auth.service';

// Communities
export {
  getCommunities,
  getCommunityById,
  getCommunityBySlug,
  getCategories,
  createCommunity,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  getJoinedCommunities
} from './communities.service';
export type { Community, Category, CreateCommunityData, UpdateCommunityData, CommunityMember } from './communities.service';

// Products
export { getProducts, getProductById, getProductBySlug, getFeaturedProducts, createProduct, updateProduct, deleteProduct } from './products.service';
export type { Product, ProductImage, CreateProductData, UpdateProductData } from './products.service';

// Brand (BrandDetails and updateBrandDetails are already exported from auth.service)
export { getBrandDetails, getBrandProducts, getBrandStats, getBrandOrders, BrandService } from './brand.service';
export type { BrandStats, UpdateBrandInput, BrandOrder } from './brand.service';

// Pitch
export * from './pitch.service';

// Cart
export * from './cart.services';

// Orders
export * from './order.service';

// Addresses
export * from './address.service';

// Posts
export * from './post.service';

// Shared types
export type { PaginatedResponse } from './communities.service';

// Admin
export * from './admin.service';

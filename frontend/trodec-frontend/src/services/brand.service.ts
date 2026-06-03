import api, { ApiSuccessResponse, getErrorMessage } from './api';
import { Product } from "./products.service";

// ============================================
// Types & Interfaces
// ============================================

export interface BrandDetails {
  id: string;
  brandName: string;
  businessType: string | null;
  websiteUrl: string | null;
  description: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  verificationDate: string | null;
  // GST / billing
  gstNumber: string | null;
  businessName: string | null;
  registeredAddress: string | null;
  billingState: string | null;
  billingPincode: string | null;
  billingEmail: string | null;
  contactNumber: string | null;
  panNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

export interface UpdateBrandInput {
  brandName?: string;
  businessType?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  gstNumber?: string | null;
  businessName?: string | null;
  registeredAddress?: string | null;
  billingState?: string | null;
  billingPincode?: string | null;
  billingEmail?: string | null;
  contactNumber?: string | null;
  panNumber?: string | null;
}

export interface BrandOrder {
  id: string;
  itemId?: string;
  orderNumber: string;
  userId?: string;
  status: string;
  total?: number;
  createdAt: string;
  shippingAddressId?: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  quantity?: number;
  subtotal?: number;
  selectedSize?: string | null;
  awbCode?: string | null;
  labelUrl?: string | null;
  courierName?: string | null;
  shipmentStatus?: string | null;
}

// ============================================
// API Functions
// ============================================

/**
 * Get current brand details
 */
export async function getBrandDetails(): Promise<BrandDetails> {
  try {
    const response = await api.get<ApiSuccessResponse<BrandDetails>>('/brands/me');
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Update brand details
 */
export async function updateBrandDetails(data: UpdateBrandInput): Promise<BrandDetails> {
  try {
    const response = await api.patch<ApiSuccessResponse<BrandDetails>>('/brands/me', data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get brand's products
 */
export async function getBrandProducts(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ data: Product[]; pagination: any }> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/brands/me/products', { params });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get brand statistics
 */
export async function getBrandStats(): Promise<BrandStats> {
  try {
    const response = await api.get<ApiSuccessResponse<BrandStats>>('/brands/me/stats');
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get brand's orders
 */
export async function getBrandOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ data: BrandOrder[]; pagination: { page: number; limit: number; total: number } }> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/brands/me/orders', { params });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// Legacy BrandService object for compatibility
// ============================================

export const BrandService = {
  getDashboardStats: getBrandStats,
  getProducts: async () => {
    const result = await getBrandProducts();
    return result.data;
  },
  getOrders: async () => {
    const result = await getBrandOrders();
    return result.data;
  },
};

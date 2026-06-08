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
  shipmentId?: string | null;
  awbCode?: string | null;
  labelUrl?: string | null;
  invoiceUrl?: string | null;
  courierName?: string | null;
  shipmentStatus?: string | null;
  hasShiprocketShipment?: boolean;
  actualShippingCost?: number;
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
// Earnings / Payouts
// ============================================

export interface BrandPayout {
  id: string;
  orderId: string;
  brandId: string;
  orderAmount: number;
  shippingCost: number;
  platformCommission: number;
  brandNet: number;
  status: "pending" | "reserved" | "paid" | "reversed";
  reversedAt: string | null;
  withdrawalRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandEarningsStats {
  totalEarned: number;
  pendingPayout: number;
  inWithdrawal: number;
  paidOut: number;
}

export interface BrandBankAccount {
  id: string;
  brandId: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId: string | null;
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: string;
}

export interface BrandWithdrawalRequest {
  id: string;
  brandId: string;
  bankAccountId: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  rejectionReason: string | null;
  requestedAt: string;
  processedAt: string | null;
  paidAt: string | null;
  transactionRef: string | null;
  createdAt: string;
  bankAccount?: { bankName: string; accountNumber: string; upiId: string | null };
}

export async function getBrandEarnings(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  data: BrandPayout[];
  pagination: { page: number; limit: number; total: number };
  stats: BrandEarningsStats;
}> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/brands/me/earnings', { params });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getBrandBankAccounts(): Promise<BrandBankAccount[]> {
  try {
    const response = await api.get<ApiSuccessResponse<BrandBankAccount[]>>('/brands/me/bank-accounts');
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function saveBrandBankAccount(data: {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId?: string;
}): Promise<BrandBankAccount> {
  try {
    const response = await api.post<ApiSuccessResponse<BrandBankAccount>>('/brands/me/bank-accounts', data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getBrandWithdrawals(params?: {
  page?: number;
  limit?: number;
}): Promise<{ data: BrandWithdrawalRequest[]; pagination: { page: number; limit: number; total: number } }> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/brands/me/withdrawals', { params });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function requestBrandWithdrawal(data: {
  amount: number;
  bankAccountId: string;
}): Promise<BrandWithdrawalRequest> {
  try {
    const response = await api.post<ApiSuccessResponse<BrandWithdrawalRequest>>('/brands/me/withdrawals', data);
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

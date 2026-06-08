import api, { ApiSuccessResponse, getErrorMessage } from './api';

// ============================================
// Types
// ============================================

export interface AdminStats {
  users: {
    total: number;
    consumers: number;
    experts: number;
    brands: number;
    admins: number;
    pendingExpertApprovals: number;
    pendingBrandApprovals: number;
  };
  products: {
    total: number;
    active: number;
    draft: number;
  };
  orders: {
    total: number;
    totalRevenue: number;
    pending: number;
    delivered: number;
  };
  communities: {
    total: number;
    active: number;
  };
  posts: {
    total: number;
    published: number;
  };
  pitches: {
    total: number;
    pending: number;
    accepted: number;
  };
}

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expert_details?: {
    is_verified: boolean;
    expertise: string[];
    bio: string | null;
    years_of_experience: number | null;
    rating: number;
    total_reviews: number;
  } | null;
  brand_details?: {
    is_verified: boolean;
    brand_name: string;
    business_type: string | null;
    website_url: string | null;
    description: string | null;
    logo_url: string | null;
  } | null;
}

export interface AdminOrderRow {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  created_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
}

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  price: number;
  stock_quantity: number;
  average_rating: number;
  review_count: number;
  is_featured: boolean;
  created_at: string;
  brand_details: { id: string; brand_name: string } | null;
  categories: { id: string; name: string } | null;
}

export interface AdminCommunityRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  member_count: number;
  expert_count: number;
  created_at: string;
  categories: { id: string; name: string } | null;
  creator: { id: string; full_name: string | null } | null;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

// ============================================
// API functions
// ============================================

export async function getAdminStats(): Promise<AdminStats> {
  try {
    const res = await api.get<ApiSuccessResponse<AdminStats>>('/admin/stats');
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminUsers(params?: {
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminUserRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminUserRow>>>('/admin/users', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminPendingBrands(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminUserRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminUserRow>>>('/admin/brands/pending', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminPendingExperts(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminUserRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminUserRow>>>('/admin/experts/pending', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminBrands(params?: {
  verified?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminUserRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminUserRow>>>('/admin/brands', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminExperts(params?: {
  verified?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminUserRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminUserRow>>>('/admin/experts', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminOrders(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminOrderRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminOrderRow>>>('/admin/orders', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminProducts(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminProductRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminProductRow>>>('/admin/products', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminCommunities(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<AdminCommunityRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminCommunityRow>>>('/admin/communities', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function adminVerifyUser(userId: string, approved: boolean): Promise<void> {
  try {
    await api.post(`/admin/users/${userId}/verify`, { approved });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function adminToggleUserActive(userId: string, active: boolean): Promise<void> {
  try {
    await api.patch(`/admin/users/${userId}/active`, { active });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function adminDeleteProduct(productId: string): Promise<void> {
  try {
    await api.delete(`/admin/products/${productId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function adminCreateShipmentForOrder(orderId: string): Promise<void> {
  try {
    await api.post(`/admin/orders/${orderId}/create-shipment`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function adminUpdateOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    await api.patch(`/admin/orders/${orderId}/status`, { status });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export interface AdminPitchRow {
  id: string;
  status: string;
  message: string | null;
  offer_details: string | null;
  sample_type: string;
  created_at: string;
  brand: { id: string; brand_name: string; logo_url: string | null } | null;
  expert: { id: string; full_name: string; email: string } | null;
  product: { id: string; name: string; slug: string } | null;
  community: { id: string; name: string; slug: string } | null;
}

export interface AdminShipmentRow {
  id: string;
  status: string;
  type: string;
  awb_code: string | null;
  tracking_url: string | null;
  label_url: string | null;
  invoice_url: string | null;
  manifest_url: string | null;
  shiprocket_order_id: string | null;
  shiprocket_shipment_id: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  order: { id: string; order_number: string; user_id: string } | null;
  pitch: { id: string; status: string } | null;
}

export interface ShipmentRetryResult {
  awbCode: string | null;
  labelUrl: string | null;
  invoiceUrl: string | null;
  manifestUrl: string | null;
  freightCharge: number | null;
}

export async function retryShipmentAwb(shipmentId: string): Promise<ShipmentRetryResult> {
  try {
    const res = await api.post<ApiSuccessResponse<ShipmentRetryResult>>(`/admin/shipments/${shipmentId}/retry-awb`);
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function retryShipmentDocuments(shipmentId: string): Promise<ShipmentRetryResult> {
  try {
    const res = await api.post<ApiSuccessResponse<ShipmentRetryResult>>(`/admin/shipments/${shipmentId}/retry-documents`);
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminPitches(params?: {
  page?: number; limit?: number; status?: string;
}): Promise<PaginatedResult<AdminPitchRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminPitchRow>>>('/admin/pitches', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function getAdminShipments(params?: {
  page?: number; limit?: number; status?: string;
}): Promise<PaginatedResult<AdminShipmentRow>> {
  try {
    const res = await api.get<ApiSuccessResponse<PaginatedResult<AdminShipmentRow>>>('/admin/shipments', { params });
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function uploadShipmentLabel(shipmentId: string, file: File): Promise<{ labelUrl: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<ApiSuccessResponse<{ labelUrl: string }>>(
      `/admin/shipments/${shipmentId}/upload-label`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

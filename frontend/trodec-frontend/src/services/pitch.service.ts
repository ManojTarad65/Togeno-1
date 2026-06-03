import api, { ApiSuccessResponse, getErrorMessage } from './api';

// ============================================
// Types & Interfaces
// ============================================

export interface Pitch {
  id: string;
  brandId: string;
  productId: string;
  communityId: string;
  expertId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'shipped' | 'delivered' | 'posted' | 'completed' | 'cancelled' | 'expired';
  message: string | null;
  offerDetails: string | null;
  requirements: string | null;
  expertResponse: string | null;
  respondedAt: string | null;
  shippingAddress: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  postId: string | null;
  postingDeadline: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePitchInput {
  productId?: string;
  communityId: string;
  expertId?: string;
  message?: string;
  offerDetails?: string;
  requirements?: string;
  postingDeadline?: string;
}

export interface UpdatePitchInput {
  status?: Pitch['status'];
  expertResponse?: string;
  productId?: string;
  shippingAddress?: string;
  trackingNumber?: string;
  postId?: string;
}

export interface PitchProductImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  displayOrder: number;
}

export interface PitchWithDetails extends Pitch {
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
    description: string | null;
    shortDescription: string | null;
    sku: string | null;
    metadata: Record<string, any>;
    images: PitchProductImage[];
    category: { id: string; name: string; slug: string } | null;
  };
  expert?: {
    id: string;
    fullName: string;
    email: string;
  };
  community?: {
    id: string;
    name: string;
  };
  brand?: {
    id: string;
    brandName: string;
    logoUrl: string | null;
  };
}

// ============================================
// API Functions
// ============================================

export interface PublicExpert {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

/**
 * Get all experts for pitch targeting
 */
export async function getPublicExperts(): Promise<PublicExpert[]> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/users/experts');
    const result = response.data.data;
    // Backend wraps as { data: [...], pagination: {...} }
    const list = Array.isArray(result) ? result : (result?.data ?? []);
    // listExperts returns { profile: Profile, expertDetails: ExpertDetails }[] with camelCase fields
    return list.map((item: any) => ({
      id: item.profile?.id ?? item.id,
      full_name: item.profile?.fullName ?? item.full_name ?? null,
      email: item.profile?.email ?? item.email ?? '',
      avatar_url: item.profile?.avatarUrl ?? item.avatar_url ?? null,
    }));
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Create a new pitch
 */
export async function createPitch(data: CreatePitchInput): Promise<Pitch> {
  try {
    const response = await api.post<ApiSuccessResponse<Pitch>>('/pitches', data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get pitches sent by the current brand (brand_admin only)
 */
export async function getSentPitches(params?: {
  page?: number;
  limit?: number;
  status?: string;
  communityId?: string;
}): Promise<{ data: PitchWithDetails[]; pagination: any }> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/pitches/sent', { params });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get pitches received by the current expert (expert only)
 */
export async function getReceivedPitches(params?: {
  page?: number;
  limit?: number;
  status?: string;
  communityId?: string;
}): Promise<{ data: PitchWithDetails[]; pagination: any }> {
  try {
    const response = await api.get<ApiSuccessResponse<any>>('/pitches/received', { params });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Expert responds to a pitch - status must be "accepted" or "declined"
 */
export async function respondToPitch(id: string, status: 'accepted' | 'declined', expertResponse?: string): Promise<Pitch> {
  try {
    const response = await api.post<ApiSuccessResponse<Pitch>>(`/pitches/${id}/respond`, { status, expertResponse });
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Expert confirms product receipt — changes pitch status from "shipped" to "delivered"
 * Required before the expert can publish a review post.
 */
export async function confirmPitchReceipt(id: string): Promise<Pitch> {
  try {
    const response = await api.post<ApiSuccessResponse<Pitch>>(`/pitches/${id}/confirm-receipt`);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Brand manually marks a pitch's sample shipment as shipped.
 * Fallback for when Shiprocket webhook doesn't fire.
 */
export async function markPitchShipped(id: string): Promise<Pitch> {
  try {
    const response = await api.post<ApiSuccessResponse<Pitch>>(`/pitches/${id}/mark-shipped`);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get all pitches (kept for backward compatibility - use getSentPitches or getReceivedPitches)
 */
export async function getPitches(params?: {
  page?: number;
  limit?: number;
  status?: string;
  communityId?: string;
  expertId?: string;
}): Promise<{ data: PitchWithDetails[]; pagination: any }> {
  return getSentPitches(params);
}

/**
 * Get a single pitch by ID
 */
export async function getPitch(id: string): Promise<PitchWithDetails> {
  try {
    const response = await api.get<ApiSuccessResponse<PitchWithDetails>>(`/pitches/${id}`);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Update a pitch
 */
export async function updatePitch(id: string, data: UpdatePitchInput): Promise<Pitch> {
  try {
    const response = await api.patch<ApiSuccessResponse<Pitch>>(`/pitches/${id}`, data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Delete a pitch
 */
export async function deletePitch(id: string): Promise<void> {
  try {
    await api.delete(`/pitches/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Update pitch status
 */
export async function updatePitchStatus(id: string, status: Pitch['status']): Promise<Pitch> {
  return updatePitch(id, { status });
}

/**
 * Add shipping information to pitch
 */
export async function addShippingInfo(id: string, trackingNumber: string): Promise<Pitch> {
  return updatePitch(id, { trackingNumber, status: 'shipped' });
}

/**
 * Mark pitch as posted
 */
export async function markPitchPosted(id: string, postId: string): Promise<Pitch> {
  return updatePitch(id, { postId, status: 'posted' });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get status color for UI display
 */
export function getPitchStatusColor(status: Pitch['status']): string {
  const colors: Record<Pitch['status'], string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    shipped: 'bg-blue-100 text-blue-800',
    delivered: 'bg-amber-100 text-amber-800',
    posted: 'bg-purple-100 text-purple-800',
    completed: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-gray-100 text-gray-800',
    expired: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get status label for UI display
 */
export function getPitchStatusLabel(status: Pitch['status']): string {
  const labels: Record<Pitch['status'], string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    shipped: 'Shipped',
    delivered: 'Delivered',
    posted: 'Posted',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return labels[status] || status;
}

/**
 * Check if pitch can be edited
 */
export function canEditPitch(pitch: Pitch): boolean {
  return ['pending', 'accepted'].includes(pitch.status);
}

/**
 * Check if pitch can be cancelled
 */
export function canCancelPitch(pitch: Pitch): boolean {
  return ['pending', 'accepted', 'shipped'].includes(pitch.status);
}

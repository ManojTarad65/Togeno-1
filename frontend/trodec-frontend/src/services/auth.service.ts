import axios from 'axios';
import api, { ApiSuccessResponse, getErrorMessage } from './api';

export type UserRole = 'consumer' | 'expert' | 'brand_admin' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertDetails {
  id: string;
  expertise: string[];
  linkedinUrl: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  isVerified: boolean;
  verificationDate: string | null;
  rating: number;
  totalReviews: number;
}

export interface BrandDetails {
  id: string;
  brandName: string;
  businessType: string | null;
  websiteUrl: string | null;
  description: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  verificationDate: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
}

export interface AuthResponseData {
  user: AuthUser;
  profile: Profile | null;
  session: Session | null;
}

export interface UserWithProfile extends AuthUser {
  profile: Profile | null;
  expertDetails?: ExpertDetails | null;
  brandDetails?: BrandDetails | null;
}

export interface SignUpData {
  email: string;
  password: string;
  role: UserRole;
  fullName?: string;
  // Expert fields
  expertise?: string[];
  linkedinUrl?: string;
  // Brand fields
  brandName?: string;
}

// ============================================
// SSR-safe token helpers
// All localStorage access is guarded with typeof window checks so these
// functions are safe to call during SSR (they simply return null/no-op).
// ============================================

function getToken(key: 'accessToken' | 'refreshToken'): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setToken(key: 'accessToken' | 'refreshToken', value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // private browsing / quota exceeded — ignore
  }
}

function removeToken(key: 'accessToken' | 'refreshToken'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function signUp(data: SignUpData): Promise<AuthResponseData> {
  try {
    const response = await api.post<ApiSuccessResponse<AuthResponseData>>('/auth/signup', data);
    const result = response.data?.data;
    if (!result) throw new Error('Unexpected response from server. Please try again.');

    if (result.session) {
      setToken('accessToken', result.session.accessToken);
      setToken('refreshToken', result.session.refreshToken);
    }

    return result;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signIn(data: SignInData): Promise<AuthResponseData> {
  try {
    const response = await api.post<ApiSuccessResponse<AuthResponseData>>('/auth/login', data);
    const result = response.data?.data;
    if (!result) throw new Error('Unexpected response from server. Please try again.');

    if (result.session) {
      setToken('accessToken', result.session.accessToken);
      setToken('refreshToken', result.session.refreshToken);
    }

    return result;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function signOut(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    // Continue with local logout even if API fails
    console.error('Logout API error:', getErrorMessage(error));
  } finally {
    removeToken('accessToken');
    removeToken('refreshToken');
  }
}

export async function getCurrentUser(): Promise<UserWithProfile | null> {
  // Guard: on the server there are no tokens — return null immediately.
  // This prevents the "localStorage is not defined" crash during SSR.
  const token = getToken('accessToken');
  if (!token) return null;

  try {
    const response = await api.get<ApiSuccessResponse<UserWithProfile>>('/users/me');
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        // Definitively unauthorized — token is invalid or expired
        removeToken('accessToken');
        removeToken('refreshToken');
        return null;
      }
      // Network error, timeout, or server error — don't log the user out
      throw error;
    }
    throw error;
  }
}

export async function getGoogleOAuthUrl(redirectTo: string): Promise<string> {
  try {
    const response = await api.get<ApiSuccessResponse<{ url: string }>>('/auth/google', {
      params: { redirectTo },
    });
    return response.data.data.url;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export interface UpdateProfileData {
  fullName?: string;
  avatarUrl?: string | null;
}

export async function updateProfile(data: UpdateProfileData): Promise<Profile> {
  try {
    const response = await api.patch<ApiSuccessResponse<Profile>>('/users/me', data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export interface UpdateExpertData {
  expertise?: string[];
  linkedinUrl?: string | null;
  bio?: string | null;
  yearsOfExperience?: number | null;
}

export async function updateExpertDetails(data: UpdateExpertData): Promise<ExpertDetails> {
  try {
    const response = await api.patch<ApiSuccessResponse<ExpertDetails>>('/users/me/expert', data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export interface UpdateBrandData {
  brandName?: string;
  businessType?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  logoUrl?: string | null;
}

export async function updateBrandDetails(data: UpdateBrandData): Promise<BrandDetails> {
  try {
    const response = await api.patch<ApiSuccessResponse<BrandDetails>>('/users/me/brand', data);
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function completeOAuth(): Promise<UserWithProfile> {
  try {
    const response = await api.post<ApiSuccessResponse<UserWithProfile>>('/auth/oauth/complete');
    return response.data.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export function isAuthenticated(): boolean {
  // FIX: guard typeof window so this is safe to call in SSR context
  if (typeof window === 'undefined') return false;
  return !!getToken('accessToken');
}

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// API calls go through the Next.js /backend rewrite proxy (same-origin).
// The rewrite is in next.config.ts:
//   source: '/backend/:path*' → destination: API_URL/:path*
//
// The server-side env var API_URL (no NEXT_PUBLIC_ prefix) must be set in
// your hosting environment. See next.config.ts for details.
const API_BASE_URL = '/backend';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Public auth endpoints — must NOT include a Bearer token
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/google',
  '/auth/oauth/complete',
];

// ============================================
// SSR-safe localStorage helpers
// ============================================

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// Request interceptor — attach Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const url = config.url ?? '';
      const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => url.endsWith(p));
      if (!isPublicAuth) {
        const token = safeGetItem('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Shared refresh promise — prevents concurrent refresh race conditions
let refreshPromise: Promise<string | null> | null = null;

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    safeRemoveItem('accessToken');
    safeRemoveItem('refreshToken');
    safeRemoveItem('trodec-auth');
    window.location.href = '/login';
  }
}

async function getNewAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = safeGetItem('refreshToken');
      if (!refreshToken) return null;

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      const { session } = response.data.data;
      if (!session) return null;

      safeSetItem('accessToken', session.accessToken);
      safeSetItem('refreshToken', session.refreshToken);
      return session.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Response interceptor — refresh on 401, retry once
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await getNewAccessToken();
      if (newToken) {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      }

      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  data: null;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return axiosError.response?.data?.message || axiosError.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export default api;

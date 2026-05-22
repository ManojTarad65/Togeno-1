import { useState, useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AuthUser,
  Profile,
  ExpertDetails,
  BrandDetails,
  UserWithProfile,
  signIn as apiSignIn,
  signUp as apiSignUp,
  signOut as apiSignOut,
  getCurrentUser,
  SignInData,
  SignUpData,
} from '@/services/auth.service';

// ============================================
// Types
// ============================================

interface AuthState {
  // State
  user: AuthUser | null;
  profile: Profile | null;
  expertDetails: ExpertDetails | null;
  brandDetails: BrandDetails | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  signIn: (data: SignInData) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  setUser: (user: UserWithProfile) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================
// Initial State
// ============================================

const initialState = {
  user: null,
  profile: null,
  expertDetails: null,
  brandDetails: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

// ============================================
// SSR-safe localStorage storage adapter
// Zustand persist calls getItem/setItem/removeItem during SSR on the server
// where localStorage doesn't exist. This wrapper guards every access.
// ============================================

const ssrSafeLocalStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(name, value);
    } catch {
      // quota exceeded or private browsing — silently ignore
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

// ============================================
// Store
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      signIn: async (data: SignInData) => {
        set({ isLoading: true, error: null });
        try {
          const result = await apiSignIn(data);
          set({
            user: result.user,
            profile: result.profile,
            isAuthenticated: true,
            isLoading: false,
          });
          // Role-specific details (expertDetails, brandDetails) are loaded by
          // each dashboard layout on first render via fetchCurrentUser.
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sign in failed',
            isLoading: false,
          });
          throw error;
        }
      },

      signUp: async (data: SignUpData) => {
        set({ isLoading: true, error: null });
        try {
          const result = await apiSignUp(data);

          // If no session returned, automatically sign in
          if (!result.session) {
            await get().signIn({
              email: data.email,
              password: data.password,
            });
          } else {
            set({
              user: result.user,
              profile: result.profile,
              isAuthenticated: true,
              isLoading: false,
            });
            await get().fetchCurrentUser();
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sign up failed',
            isLoading: false,
          });
          throw error;
        }
      },

      signOut: async () => {
        set({ isLoading: true });
        try {
          await apiSignOut();
        } finally {
          set({
            ...initialState,
            isLoading: false,
          });
        }
      },

      fetchCurrentUser: async () => {
        set({ isLoading: true, error: null });
        try {
          const userWithProfile = await getCurrentUser();

          if (userWithProfile) {
            set({
              user: {
                id: userWithProfile.id,
                email: userWithProfile.email,
                createdAt: userWithProfile.createdAt,
              },
              profile: userWithProfile.profile,
              expertDetails: userWithProfile.expertDetails || null,
              brandDetails: userWithProfile.brandDetails || null,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // null = no token or definitive 401 — user is not authenticated
            set({ ...initialState, isLoading: false });
          }
        } catch {
          // Network error, timeout, or server error.
          // Do NOT clear isAuthenticated — the session may still be valid.
          set({ isLoading: false });
        }
      },

      setUser: (userWithProfile: UserWithProfile) => {
        set({
          user: {
            id: userWithProfile.id,
            email: userWithProfile.email,
            createdAt: userWithProfile.createdAt,
          },
          profile: userWithProfile.profile,
          expertDetails: userWithProfile.expertDetails || null,
          brandDetails: userWithProfile.brandDetails || null,
          isAuthenticated: true,
        });
      },

      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }),
    {
      name: 'trodec-auth',
      // FIX: Use SSR-safe storage adapter instead of bare `() => localStorage`.
      // The bare version throws "localStorage is not defined" during SSR in
      // production (Vercel runs Next.js server-side). The adapter returns null
      // on the server and only accesses localStorage in the browser.
      storage: createJSONStorage(() => ssrSafeLocalStorage),
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        expertDetails: state.expertDetails,
        brandDetails: state.brandDetails,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================
// Selectors
// ============================================

export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
export const selectUserRole = (state: AuthState) => state.profile?.role;

// Returns true once Zustand has finished loading persisted state from localStorage.
// Use this before checking isAuthenticated on page load to avoid hydration race conditions.
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

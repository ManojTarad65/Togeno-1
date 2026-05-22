import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware is intentionally minimal.
// Auth is handled client-side via Zustand + localStorage (JWT from custom backend).
// The middleware only lets all requests through — protected routes are guarded
// by each layout component, which waits for Zustand hydration before checking
// the stored token. This is the correct pattern for custom JWT auth in Next.js.
//
// NOTE: Do NOT access localStorage here — middleware runs on the Edge runtime
// where localStorage is not available (same as SSR). The Zustand persist adapter
// and all localStorage calls in services/auth.service.ts are already guarded
// with `typeof window === 'undefined'` checks.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};

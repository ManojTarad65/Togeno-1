import type { NextConfig } from "next";

// IMPORTANT: Next.js rewrites run server-side at runtime.
// NEXT_PUBLIC_ variables are baked into the client bundle at BUILD time
// and are undefined on the server — so process.env.NEXT_PUBLIC_API_URL
// is always undefined here, causing the rewrite to fall back to localhost.
//
// FIX: Use a server-only env var (no NEXT_PUBLIC_ prefix) for the rewrite
// destination. Add API_URL (without NEXT_PUBLIC_) to your hosting environment
// variables alongside the existing NEXT_PUBLIC_API_URL.
//
// In your Hostinger/Vercel environment variables, set:
//   API_URL=https://api.trodec.in/api          ← used by this rewrite (server)
//   NEXT_PUBLIC_API_URL=https://api.trodec.in/api  ← keep this too (client bundle)

const nextConfig: NextConfig = {
  compress: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  async rewrites() {
    // Use API_URL (server-side only, no NEXT_PUBLIC_ prefix) so it's
    // available at runtime on the server, not just in the client bundle.
    const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
    return [
      {
        source: '/backend/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/orders',
        destination: '/consumer/orders',
        permanent: true,
      },
      {
        source: '/products',
        destination: '/consumer/products',
        permanent: true,
      },
      {
        source: '/cart',
        destination: '/consumer/cart',
        permanent: true,
      },
      {
        source: '/checkout',
        destination: '/consumer/checkout',
        permanent: true,
      },
      {
        source: '/profile',
        destination: '/consumer/profile',
        permanent: true,
      }
    ];
  }
};

export default nextConfig;

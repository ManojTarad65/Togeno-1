import { CorsOptions } from 'cors';
import { env } from './env';

// Build allowed origins from CORS_ORIGIN env var (comma-separated list).
// Example value in Hostinger backend env vars:
//   CORS_ORIGIN=https://trodec.com
const allowedOrigins = new Set(
  env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
);

export const corsOptions: CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Always allow localhost in any environment (dev)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      callback(null, true);
      return;
    }

    // Allow trodec.com and any *.trodec.com subdomain
    if (origin.endsWith('.trodec.com') || origin === 'https://trodec.com') {
      callback(null, true);
      return;
    }

    // Allow Vercel preview deployments (*.vercel.app) for staging
    if (origin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }

    // Fall back to explicit CORS_ORIGIN allowlist
    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};

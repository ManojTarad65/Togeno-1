import { z } from 'zod';
import dotenv from 'dotenv';

// Only load .env file in local development — on production (Hostinger),
// env vars are injected by the platform and dotenv file-parsing can
// mangle special characters like ! and % by adding backslash escapes.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),

  // Supabase
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Supabase OAuth
  SUPABASE_JWT_SECRET: z.string().min(1),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

  // Shiprocket — strip surrounding quotes Hostinger may inject (e.g. "value" → value)
  SHIPROCKET_EMAIL: z.string().min(1).transform(v => v.trim().replace(/^["']|["']$/g, '')),
  SHIPROCKET_PASSWORD: z.string().min(1).transform(v => v.trim().replace(/^["']|["']$/g, '')),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional().transform(v => v?.trim().replace(/^["']|["']$/g, '')),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const env = parsed.data;

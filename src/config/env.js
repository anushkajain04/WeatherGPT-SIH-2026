import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database Connection
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required and cannot be empty'),

  // Authentication & Secrets (at least 32 characters)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  OTP_HASH_SECRET: z.string().min(32, 'OTP_HASH_SECRET must be at least 32 characters long'),

  // Session Cookie Configuration
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),

  // Delivery Providers & SMTP Configuration
  MAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMS_PROVIDER: z.enum(['console', 'custom']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('WeatherGPT <noreply@weathergpt.local>'),

  // Upstream RAG Service
  RAG_BASE_URL: z.string().url('RAG_BASE_URL must be a valid URL'),
  RAG_API_KEY: z.string().min(1, 'RAG_API_KEY is required and cannot be empty'),
  RAG_FORWARD_COORDS: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1')
    .default('false'),

  // Bhashini AI Credentials
  BHASHINI_UDYAT_KEY: z.string().min(1, 'BHASHINI_UDYAT_KEY is required and cannot be empty'),
  BHASHINI_INFERENCE_KEY: z.string().min(1, 'BHASHINI_INFERENCE_KEY is required and cannot be empty'),

  // CORS Allowed Origins (comma-separated)
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required (comma-separated origins)'),

  // Optional Client API Key for protecting Express endpoints
  CLIENT_API_KEY: z.string().optional(),

  // Chat Rate Limiting
  CHAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000), // 15 mins
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // RAG Cold Start & Warm Timeouts (ms)
  // Cold start timeout set so attempt 1 + retry stay under 85s (e.g. 40s + 1s delay + 40s = 81s)
  RAG_COLD_TIMEOUT_MS: z.coerce.number().int().positive().default(40000), // 40 seconds per attempt
  RAG_WARM_TIMEOUT_MS: z.coerce.number().int().positive().default(10000), // 10 seconds warm

  // Background Keep-Warm Worker for Render Free Tier
  KEEP_WARM: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),

  // OpenStreetMap Nominatim Contact Email
  GEOCODING_CONTACT_EMAIL: z.string().email().default('contact@weathergpt.local'),

  // OpenWeatherMap API Key
  OPENWEATHER_API_KEY: z.string().optional(),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('\n======================================================');
    console.error('FATAL: Environment configuration validation failed:');
    console.error(errorDetails);
    console.error('Please configure all required variables in your .env file.');
    console.error('======================================================\n');

    process.exit(1);
  }

  const data = result.data;

  // Refuse console delivery drivers in production
  if (data.NODE_ENV === 'production') {
    if (data.MAIL_PROVIDER === 'console') {
      console.error('FATAL: MAIL_PROVIDER cannot be set to "console" in production.');
      process.exit(1);
    }
    if (data.SMS_PROVIDER === 'console') {
      console.error('FATAL: SMS_PROVIDER cannot be set to "console" in production.');
      process.exit(1);
    }
  }

  // Parse ALLOWED_ORIGINS into an array of clean origins
  const allowedOriginsList = data.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowedOriginsList.length === 0) {
    console.error('FATAL: ALLOWED_ORIGINS must contain at least one valid origin.');
    process.exit(1);
  }

  // Secure flag must be forced on when SameSite is 'none'
  const effectiveCookieSecure =
    data.COOKIE_SAME_SITE === 'none' ? true : Boolean(data.COOKIE_SECURE);

  return Object.freeze({
    ...data,
    COOKIE_SECURE: effectiveCookieSecure,
    ALLOWED_ORIGINS_LIST: Object.freeze(allowedOriginsList),
  });
};

export const env = parseEnv();
export default env;

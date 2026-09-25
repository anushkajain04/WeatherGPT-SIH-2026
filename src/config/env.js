import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Upstream RAG Service
  RAG_BASE_URL: z.string().url('RAG_BASE_URL must be a valid URL'),
  RAG_API_KEY: z.string().min(1, 'RAG_API_KEY is required and cannot be empty'),

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
  RAG_COLD_TIMEOUT_MS: z.coerce.number().int().positive().default(65000), // 65 seconds for cold start
  RAG_WARM_TIMEOUT_MS: z.coerce.number().int().positive().default(10000), // 10 seconds warm

  // Background Keep-Warm Worker for Render Free Tier
  KEEP_WARM: z
    .string()
    .optional()
    .transform((val) => val === 'true' || val === '1'),
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

  // Parse ALLOWED_ORIGINS into an array of clean origins
  const allowedOriginsList = data.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowedOriginsList.length === 0) {
    console.error('FATAL: ALLOWED_ORIGINS must contain at least one valid origin.');
    process.exit(1);
  }

  return Object.freeze({
    ...data,
    ALLOWED_ORIGINS_LIST: Object.freeze(allowedOriginsList),
  });
};

export const env = parseEnv();
export default env;


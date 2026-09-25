import { z } from 'zod';
import { SUPPORTED_LANGUAGE_CODES, WHITELISTED_ROLES } from '../config/constants.js';

const locationRegex = /^[a-zA-Z\s,-]+$/;

export const chatBodySchema = z.object({
  query: z
    .string({ required_error: 'Field "query" is required' })
    .trim()
    .min(1, 'Field "query" cannot be empty')
    .max(500, 'Field "query" cannot exceed 500 characters'),

  role: z
    .enum(WHITELISTED_ROLES, {
      errorMap: () => ({
        message: `Field "role" must be one of: ${WHITELISTED_ROLES.join(', ')}`,
      }),
    })
    .default('normal_user'),

  location: z
    .string()
    .trim()
    .max(100, 'Field "location" cannot exceed 100 characters')
    .regex(locationRegex, 'Field "location" can only contain letters, spaces, commas, and hyphens')
    .optional()
    .or(z.literal('')),

  language: z
    .string()
    .trim()
    .toLowerCase()
    .refine((val) => !val || SUPPORTED_LANGUAGE_CODES.includes(val), {
      message: `Field "language" must be a supported language code (e.g. ${SUPPORTED_LANGUAGE_CODES.slice(0, 5).join(', ')}, ...)`,
    })
    .optional()
    .or(z.literal('')),

  sessionId: z.string().trim().max(100).optional().or(z.literal('')),
});

export const voiceChatBodySchema = z.object({
  language: z
    .string({ required_error: 'Field "language" is required for voice input (ASR cannot auto-detect)' })
    .trim()
    .toLowerCase()
    .refine((val) => SUPPORTED_LANGUAGE_CODES.includes(val), {
      message: `Field "language" must be a supported language code (e.g. ${SUPPORTED_LANGUAGE_CODES.slice(0, 5).join(', ')}, ...)`,
    }),

  role: z
    .enum(WHITELISTED_ROLES, {
      errorMap: () => ({
        message: `Field "role" must be one of: ${WHITELISTED_ROLES.join(', ')}`,
      }),
    })
    .default('normal_user'),

  location: z
    .string()
    .trim()
    .max(100, 'Field "location" cannot exceed 100 characters')
    .regex(locationRegex, 'Field "location" can only contain letters, spaces, commas, and hyphens')
    .optional()
    .or(z.literal('')),

  sessionId: z.string().trim().max(100).optional().or(z.literal('')),
});


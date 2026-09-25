import { z } from 'zod';
import { SUPPORTED_LANGUAGE_CODES } from '../config/constants.js';

export const ttsBodySchema = z.object({
  text: z
    .string({ required_error: 'Field "text" is required' })
    .trim()
    .min(1, 'Field "text" cannot be empty')
    .max(1000, 'Field "text" cannot exceed 1000 characters'),

  language: z
    .string({ required_error: 'Field "language" is required' })
    .trim()
    .toLowerCase()
    .refine((val) => SUPPORTED_LANGUAGE_CODES.includes(val), {
      message: `Field "language" must be a supported language code (e.g. ${SUPPORTED_LANGUAGE_CODES.slice(0, 5).join(', ')}, ...)`,
    }),

  gender: z.enum(['female', 'male']).default('female'),
});


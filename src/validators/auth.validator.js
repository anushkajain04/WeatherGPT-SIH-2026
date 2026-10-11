import { z } from 'zod';
import { WHITELISTED_ROLES, SUPPORTED_LANGUAGE_CODES } from '../config/constants.js';

const locationRegex = /^[a-zA-Z\s,-]+$/;

export const otpRequestSchema = z.object({
  contact: z
    .string({ required_error: 'Field "contact" is required' })
    .trim()
    .min(1, 'Field "contact" cannot be empty'),
});

export const otpVerifySchema = z.object({
  contact: z
    .string({ required_error: 'Field "contact" is required' })
    .trim()
    .min(1, 'Field "contact" cannot be empty'),

  code: z
    .string({ required_error: 'Field "code" is required' })
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only numeric digits'),
});

function capitalizeWords(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .transform((val) => capitalizeWords(val))
      .optional(),

    role: z
      .enum(WHITELISTED_ROLES, {
        errorMap: () => ({
          message: `Field "role" must be one of: ${WHITELISTED_ROLES.join(', ')}`,
        }),
      })
      .optional(),

    location: z
      .string()
      .trim()
      .max(100, 'Field "location" cannot exceed 100 characters')
      .regex(locationRegex, 'Field "location" can only contain letters, spaces, commas, and hyphens')
      .optional()
      .or(z.literal('')),

    preferredLanguage: z
      .string()
      .trim()
      .toLowerCase()
      .refine((val) => SUPPORTED_LANGUAGE_CODES.includes(val), {
        message: `Field "preferredLanguage" must be a supported language code`,
      })
      .optional(),

    secondaryContact: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.role !== undefined ||
      data.location !== undefined ||
      data.preferredLanguage !== undefined ||
      data.secondaryContact !== undefined,
    { message: 'At least one field (name, role, location, preferredLanguage, secondaryContact) must be provided for update.' }
  );

export const linkContactRequestSchema = z.object({
  contact: z
    .string({ required_error: 'Field "contact" is required' })
    .trim()
    .min(1, 'Field "contact" cannot be empty'),
});

export const linkContactVerifySchema = z.object({
  contact: z
    .string({ required_error: 'Field "contact" is required' })
    .trim()
    .min(1, 'Field "contact" cannot be empty'),

  code: z
    .string({ required_error: 'Field "code" is required' })
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only numeric digits'),
});

export default {
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
  linkContactRequestSchema,
  linkContactVerifySchema,
};

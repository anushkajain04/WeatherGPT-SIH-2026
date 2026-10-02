import { ValidationError } from './errors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CLEAN_REGEX = /[\s\-()]/g;
const INDIAN_PHONE_REGEX = /^(?:\+91|91|0)?([6-9]\d{9})$/;

/**
 * Normalizes email or Indian phone number into standard canonical representation.
 * - Emails are trimmed and lowercased.
 * - Phones accept 10 digits starting 6–9 with optional +91, 91, or 0 prefix, spaces/hyphens stripped, output +91XXXXXXXXXX.
 * - Any invalid format throws a 422 ValidationError.
 *
 * @param {string} rawContact
 * @returns {{ contact: string, type: 'email' | 'phone' }}
 */
export function normalizeContact(rawContact) {
  if (!rawContact || typeof rawContact !== 'string') {
    throw new ValidationError(
      'Contact is required and must be a valid email or 10-digit Indian phone number.'
    );
  }

  const trimmed = rawContact.trim();

  // 1. Check for email
  if (trimmed.includes('@')) {
    const lowerEmail = trimmed.toLowerCase();
    if (!EMAIL_REGEX.test(lowerEmail)) {
      throw new ValidationError('Invalid email address format.');
    }
    return { contact: lowerEmail, type: 'email' };
  }

  // 2. Check for Indian mobile number
  const cleanedPhone = trimmed.replace(PHONE_CLEAN_REGEX, '');
  const phoneMatch = cleanedPhone.match(INDIAN_PHONE_REGEX);

  if (phoneMatch) {
    const tenDigits = phoneMatch[1];
    return { contact: `+91${tenDigits}`, type: 'phone' };
  }

  throw new ValidationError(
    'Invalid contact format. Please provide a valid email address or a 10-digit Indian mobile number.'
  );
}

export default normalizeContact;

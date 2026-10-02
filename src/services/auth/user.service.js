import User from '../../models/user.model.js';
import { ConflictError, ValidationError, NotFoundError } from '../../utils/errors.js';

/**
 * Format user model to public sanitized representation.
 */
export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    email: user.email || null,
    phone: user.phone || null,
    role: user.role,
    location: user.location || null,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

/**
 * Find user by ID.
 *
 * @param {string} userId
 */
export async function findUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found.');
  }
  return user;
}

/**
 * Find or create user by normalized contact upon successful OTP verification.
 * Applies initial profile fields only when creating a new user account.
 *
 * @param {{ contact: string, type: 'email'|'phone' }} contactInfo
 * @param {object} [profile]
 * @returns {Promise<object>} Sanitized user
 */
export async function findOrCreateUser(contactInfo, profile = {}) {
  const query =
    contactInfo.type === 'email'
      ? { email: contactInfo.contact }
      : { phone: contactInfo.contact };

  let user = await User.findOne(query);

  if (user) {
    // Existing user: update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();
    return sanitizeUser(user);
  }

  // New user: construct initial document
  const newUserData = {
    role: profile.role || 'normal_user',
    location: profile.location || undefined,
    preferredLanguage: profile.preferredLanguage || 'en',
    lastLoginAt: new Date(),
  };

  if (contactInfo.type === 'email') {
    newUserData.email = contactInfo.contact;
  } else {
    newUserData.phone = contactInfo.contact;
  }

  user = await User.create(newUserData);
  return sanitizeUser(user);
}

/**
 * Updates profile fields on the current user (role, location, preferredLanguage only).
 *
 * @param {string} userId
 * @param {object} updates
 */
export async function updateUserProfile(userId, { role, location, preferredLanguage }) {
  const user = await findUserById(userId);

  if (role !== undefined) user.role = role;
  if (location !== undefined) user.location = location || undefined;
  if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

  await user.save();
  return sanitizeUser(user);
}

/**
 * Verifies that a user can request to link a contact:
 * 1. User does not already possess that contact type (never overwrite).
 * 2. Contact is not already associated with another user account (409 Conflict).
 *
 * @param {object} user - Current user document
 * @param {{ contact: string, type: 'email'|'phone' }} contactInfo
 */
export async function verifyCanLinkContact(user, contactInfo) {
  // Ensure user does not already have this contact type
  if (contactInfo.type === 'email' && user.email) {
    throw new ValidationError('Your account already has an email address linked. Cannot overwrite existing email.');
  }
  if (contactInfo.type === 'phone' && user.phone) {
    throw new ValidationError('Your account already has a phone number linked. Cannot overwrite existing phone.');
  }

  // Check if contact already belongs to another account
  const query =
    contactInfo.type === 'email'
      ? { email: contactInfo.contact }
      : { phone: contactInfo.contact };

  const existing = await User.findOne(query);
  if (existing && existing._id.toString() !== user._id.toString()) {
    throw new ConflictError('This contact is already associated with another account.');
  }
}

/**
 * Links verified contact to the user account.
 * Re-runs 409 check at verify time to prevent race conditions.
 *
 * @param {string} userId
 * @param {{ contact: string, type: 'email'|'phone' }} contactInfo
 */
export async function linkContactToUser(userId, contactInfo) {
  const user = await findUserById(userId);

  // Re-verify that user does not already possess this contact type
  if (contactInfo.type === 'email' && user.email) {
    throw new ConflictError('Your account already has an email address linked.');
  }
  if (contactInfo.type === 'phone' && user.phone) {
    throw new ConflictError('Your account already has a phone number linked.');
  }

  // Re-check duplicate contact ownership at verify time
  const query =
    contactInfo.type === 'email'
      ? { email: contactInfo.contact }
      : { phone: contactInfo.contact };

  const existing = await User.findOne(query);
  if (existing && existing._id.toString() !== user._id.toString()) {
    throw new ConflictError('This contact is already associated with another account.');
  }

  if (contactInfo.type === 'email') {
    user.email = contactInfo.contact;
  } else {
    user.phone = contactInfo.contact;
  }

  await user.save();
  return sanitizeUser(user);
}

export default {
  sanitizeUser,
  findUserById,
  findOrCreateUser,
  updateUserProfile,
  verifyCanLinkContact,
  linkContactToUser,
};

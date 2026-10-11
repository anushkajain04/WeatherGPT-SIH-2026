import User from '../../models/user.model.js';
import normalizeContact from '../../utils/contact.js';
import { ConflictError, ValidationError, NotFoundError } from '../../utils/errors.js';

/**
 * Format user model to public sanitized representation.
 */
export function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name || null,
    email: user.email || null,
    emailVerified: user.emailVerified ?? false,
    phone: user.phone || null,
    phoneVerified: user.phoneVerified ?? false,
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
 * Creates minimal user document with default values on signup.
 *
 * @param {{ contact: string, type: 'email'|'phone' }} contactInfo
 * @returns {Promise<{ user: object, isNewUser: boolean }>} Sanitized user and isNewUser flag
 */
export async function findOrCreateUser(contactInfo) {
  const query =
    contactInfo.type === 'email'
      ? { email: contactInfo.contact }
      : { phone: contactInfo.contact };

  let user = await User.findOne(query);

  if (user) {
    // A contact with *Verified: false cannot be used to log in
    if (contactInfo.type === 'email' && user.emailVerified === false) {
      throw new ValidationError(
        'This email address is pending verification on an existing account. Please log in with your primary phone number.'
      );
    }
    if (contactInfo.type === 'phone' && user.phoneVerified === false) {
      throw new ValidationError(
        'This phone number is pending verification on an existing account. Please log in with your primary email.'
      );
    }

    // Existing user: mark current login contact verified and update last login timestamp
    if (contactInfo.type === 'email') user.emailVerified = true;
    if (contactInfo.type === 'phone') user.phoneVerified = true;
    user.lastLoginAt = new Date();

    await user.save();
    return { user: sanitizeUser(user), isNewUser: false };
  }

  // New user: construct initial document with default role and language; name/location empty
  const newUserData = {
    role: 'normal_user',
    preferredLanguage: 'en',
    lastLoginAt: new Date(),
  };

  if (contactInfo.type === 'email') {
    newUserData.email = contactInfo.contact;
    newUserData.emailVerified = true;
  } else {
    newUserData.phone = contactInfo.contact;
    newUserData.phoneVerified = true;
  }

  user = await User.create(newUserData);
  return { user: sanitizeUser(user), isNewUser: true };
}

/**
 * Updates profile fields on the current user (name, role, location, preferredLanguage, secondaryContact).
 *
 * @param {string} userId
 * @param {object} updates
 */
export async function updateUserProfile(userId, { name, role, location, preferredLanguage, secondaryContact }) {
  const user = await findUserById(userId);

  if (name !== undefined) user.name = name || undefined;
  if (role !== undefined) user.role = role;
  if (location !== undefined) user.location = location || undefined;
  if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

  if (secondaryContact) {
    const secondary = normalizeContact(secondaryContact);
    const conflictQuery =
      secondary.type === 'email' ? { email: secondary.contact } : { phone: secondary.contact };
    const existingOwner = await User.findOne(conflictQuery);
    if (existingOwner && existingOwner._id.toString() !== user._id.toString()) {
      throw new ConflictError('Secondary contact is already associated with another account.');
    }
    if (secondary.type === 'email') {
      if (user.email && user.emailVerified) {
        throw new ValidationError('Your account already has a verified email address.');
      }
      user.email = secondary.contact;
      user.emailVerified = false;
    } else {
      if (user.phone && user.phoneVerified) {
        throw new ValidationError('Your account already has a verified phone number.');
      }
      user.phone = secondary.contact;
      user.phoneVerified = false;
    }
  }

  await user.save();
  return sanitizeUser(user);
}

/**
 * Verifies that a user can request to link a contact:
 * 1. User does not already possess a VERIFIED contact of that type.
 * 2. Contact is not already associated with another user account (409 Conflict).
 *
 * @param {object} user - Current user document
 * @param {{ contact: string, type: 'email'|'phone' }} contactInfo
 */
export async function verifyCanLinkContact(user, contactInfo) {
  // Ensure user does not already have a verified contact of this type
  if (contactInfo.type === 'email' && user.email && user.emailVerified) {
    throw new ValidationError('Your account already has a verified email address linked. Cannot overwrite existing email.');
  }
  if (contactInfo.type === 'phone' && user.phone && user.phoneVerified) {
    throw new ValidationError('Your account already has a verified phone number linked. Cannot overwrite existing phone.');
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

  if (contactInfo.type === 'email' && user.email && user.emailVerified) {
    throw new ConflictError('Your account already has a verified email address linked.');
  }
  if (contactInfo.type === 'phone' && user.phone && user.phoneVerified) {
    throw new ConflictError('Your account already has a verified phone number linked.');
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
    user.emailVerified = true;
  } else {
    user.phone = contactInfo.contact;
    user.phoneVerified = true;
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

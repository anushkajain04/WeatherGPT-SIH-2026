import mongoose from 'mongoose';
import { WHITELISTED_ROLES, SUPPORTED_LANGUAGE_CODES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: undefined,
    },
    phone: {
      type: String,
      trim: true,
      default: undefined,
    },
    role: {
      type: String,
      enum: WHITELISTED_ROLES,
      default: 'normal_user',
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
      match: [/^[a-zA-Z\s,-]*$/, 'Location can only contain Latin letters, spaces, commas, and hyphens'],
      default: undefined,
    },
    preferredLanguage: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      default: 'en',
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    versionKey: false,
  }
);

// Prevent storing empty strings or nulls for optional sparse/partial index fields
userSchema.pre('save', function () {
  if (this.email === '' || this.email === null) {
    this.email = undefined;
  }
  if (this.phone === '' || this.phone === null) {
    this.phone = undefined;
  }
  if (this.location === '' || this.location === null) {
    this.location = undefined;
  }

  // Validate that at least one contact method exists
  if (!this.email && !this.phone) {
    throw new Error('User must have at least one contact method (email or phone).');
  }
});

// Partial unique indexes: only index documents where the field is a string, preventing null duplicates
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);

userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);

export const User = mongoose.model('User', userSchema);
export default User;

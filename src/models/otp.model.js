import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    contact: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    contactType: {
      type: String,
      enum: ['email', 'phone'],
      required: true,
    },
    codeHash: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    resendCount: {
      type: Number,
      default: 1,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// MongoDB TTL index: removes document once expiresAt timestamp is reached (1-hour retention)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Contact compound index for quick lookups
otpSchema.index({ contact: 1, contactType: 1 });

export const Otp = mongoose.model('Otp', otpSchema);
export default Otp;

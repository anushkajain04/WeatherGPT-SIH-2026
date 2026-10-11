import mongoose from 'mongoose';

const otpLockoutSchema = new mongoose.Schema(
  {
    contact: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    hourlyCapHits: {
      type: [Date],
      default: [],
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

otpLockoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpLockout = mongoose.model('OtpLockout', otpLockoutSchema);
export default OtpLockout;

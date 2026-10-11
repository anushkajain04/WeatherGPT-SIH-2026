import crypto from 'crypto';
import env from '../../config/env.js';
import Otp from '../../models/otp.model.js';
import OtpLockout from '../../models/otp-lockout.model.js';
import { sendEmailOtp } from './email.service.js';
import { sendSmsOtp } from './sms.service.js';
import { ValidationError, RateLimitError } from '../../utils/errors.js';

const OTP_EXPIRY_MS = 5 * 60 * 1000;       // 5 minutes code validity
const OTP_RETENTION_MS = 60 * 60 * 1000;   // 1 hour document retention for rate limiting
const RESEND_COOLDOWN_MS = 30 * 1000;       // 30 seconds resend cooldown
const MAX_HOURLY_RESENDS = 5;               // 5 OTPs max per contact per hour
const MAX_VERIFY_ATTEMPTS = 5;              // 5 verify attempts before code invalidation
const HOURLY_BURST_COOLDOWN_MS = 30 * 1000; // Cooldown between counting separate hourly cap strikes
const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours lockout
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;   // 24 hours rolling window
const MAX_HOURLY_STRIKES = 3;               // 3 strikes within 24 hours triggers 24h lock

/**
 * Hash raw OTP code using HMAC-SHA256.
 *
 * @param {string} code
 * @returns {string} Hex-encoded HMAC hash
 */
function hashOtp(code) {
  return crypto.createHmac('sha256', env.OTP_HASH_SECRET).update(code).digest('hex');
}

/**
 * Constant-time hash comparison using crypto.timingSafeEqual.
 *
 * @param {string} a - Hex hash
 * @param {string} b - Hex hash
 * @returns {boolean}
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates and dispatches a 6-digit OTP code to a normalized contact.
 *
 * @param {string} contact - Normalized email or phone (+91XXXXXXXXXX)
 * @param {'email'|'phone'} contactType
 */
export async function generateAndSendOtp(contact, contactType) {
  const now = new Date();

  // 0. Check active 24-hour lockout tier
  const lockout = await OtpLockout.findOne({ contact });
  if (lockout && lockout.lockedUntil && lockout.lockedUntil > now) {
    const unlockTimeStr = lockout.lockedUntil.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    throw new RateLimitError(
      `Too many OTP requests. This contact is locked for 24 hours. You can try again after ${unlockTimeStr} (${lockout.lockedUntil.toISOString()}).`
    );
  }

  const existing = await Otp.findOne({ contact });

  if (existing) {
    // 1. Resend cooldown check (30 seconds)
    const timeSinceLastSent = now.getTime() - existing.lastSentAt.getTime();
    if (timeSinceLastSent < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastSent) / 1000);
      throw new RateLimitError(`Please wait ${waitSeconds} seconds before requesting a new OTP.`);
    }

    // 2. Hourly send cap check (max 5 OTPs per hour)
    if (existing.resendCount >= MAX_HOURLY_RESENDS) {
      // Track hourly cap strike in rolling 24-hour window
      let userLockout = lockout || (await OtpLockout.findOne({ contact }));
      if (!userLockout) {
        userLockout = new OtpLockout({
          contact,
          hourlyCapHits: [],
          expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        });
      }

      const windowStart = now.getTime() - ROLLING_WINDOW_MS;
      const recentHits = (userLockout.hourlyCapHits || []).filter((d) => d.getTime() > windowStart);

      // Only append new hit if not duplicate hit within burst cooldown
      const lastHit = recentHits[recentHits.length - 1];
      if (!lastHit || now.getTime() - lastHit.getTime() > HOURLY_BURST_COOLDOWN_MS) {
        recentHits.push(now);
      }

      userLockout.hourlyCapHits = recentHits;
      userLockout.expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // If contact hits the hourly cap 3 separate times within 24 hours, lock for 24h
      if (recentHits.length >= MAX_HOURLY_STRIKES) {
        userLockout.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
        await userLockout.save();
        const unlockTimeStr = userLockout.lockedUntil.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        throw new RateLimitError(
          `You have reached the hourly OTP limit ${recentHits.length} times in 24 hours. This contact is locked for the next 24 hours until ${unlockTimeStr} (${userLockout.lockedUntil.toISOString()}).`
        );
      }

      await userLockout.save();
      throw new RateLimitError('Maximum OTP requests exceeded for this hour. Please try again later.');
    }
  }

  // 3. Generate 6-digit numeric OTP code using crypto.randomInt (never Math.random)
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = hashOtp(code);
  const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);
  const expiresAt = existing ? existing.expiresAt : new Date(now.getTime() + OTP_RETENTION_MS);

  if (existing) {
    existing.codeHash = codeHash;
    existing.otpExpiresAt = otpExpiresAt;
    existing.attempts = 0;
    existing.resendCount += 1;
    existing.lastSentAt = now;
    await existing.save();
  } else {
    await Otp.create({
      contact,
      contactType,
      codeHash,
      otpExpiresAt,
      expiresAt,
      attempts: 0,
      resendCount: 1,
      lastSentAt: now,
    });
  }

  // 4. Dispatch code via provider (OTP code is never returned or logged)
  if (contactType === 'email') {
    await sendEmailOtp({ to: contact, code });
  } else {
    await sendSmsOtp({ to: contact, code });
  }

  return { success: true };
}

/**
 * Verifies provided OTP code against stored HMAC hash.
 *
 * @param {string} contact - Normalized contact string
 * @param {string} providedCode - 6-digit OTP code to verify
 * @returns {Promise<{ success: boolean, contactType: string }>}
 */
export async function verifyOtp(contact, providedCode) {
  const record = await Otp.findOne({ contact });

  if (!record || !record.codeHash || !record.otpExpiresAt) {
    throw new ValidationError('Invalid or expired verification code.');
  }

  // 1. Check if maximum attempts reached
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    record.codeHash = null;
    record.otpExpiresAt = null;
    await record.save();
    throw new ValidationError(
      'Verification code has exceeded the maximum attempts and is no longer valid. Please request a new code.'
    );
  }

  // 2. Check 5-minute code expiration
  if (Date.now() > record.otpExpiresAt.getTime()) {
    record.codeHash = null;
    record.otpExpiresAt = null;
    await record.save();
    throw new ValidationError('Verification code has expired. Please request a new code.');
  }

  // 3. Increment attempts count
  record.attempts += 1;

  // 4. Compare HMAC hashes using timingSafeEqual
  const providedHash = hashOtp(providedCode);
  const isMatch = safeCompare(providedHash, record.codeHash);

  if (!isMatch) {
    await record.save();
    const remaining = Math.max(0, MAX_VERIFY_ATTEMPTS - record.attempts);
    throw new ValidationError(`Invalid verification code. ${remaining} attempts remaining.`);
  }

  // 5. Successful verification: clear codeHash & otpExpiresAt to prevent reuse,
  // while retaining document until expiresAt (1 hour TTL) to preserve the hourly send cap.
  const verifiedContactType = record.contactType;
  record.codeHash = null;
  record.otpExpiresAt = null;
  await record.save();

  return { success: true, contactType: verifiedContactType };
}

export default { generateAndSendOtp, verifyOtp };

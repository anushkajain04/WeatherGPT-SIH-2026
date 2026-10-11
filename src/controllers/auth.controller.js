import env from '../config/env.js';
import normalizeContact from '../utils/contact.js';
import otpService from '../services/auth/otp.service.js';
import userService from '../services/auth/user.service.js';
import tokenService from '../services/auth/token.service.js';
import { RateLimitError, ValidationError, AppError } from '../utils/errors.js';

const COOKIE_NAME = 'wgpt_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Standard cookie configuration helper ensuring identical options for set and clear.
 */
function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.COOKIE_SECURE,
    path: '/',
  };
}

export class AuthController {
  /**
   * POST /api/auth/otp/request
   * Dispatches OTP without checking user existence to prevent account enumeration.
   */
  async requestOtp(req, res, next) {
    try {
      const { contact } = req.body;
      const normalized = normalizeContact(contact);

      try {
        await otpService.generateAndSendOtp(normalized.contact, normalized.type);
      } catch (sendErr) {
        // Rate limit and validation errors bubble up directly
        if (sendErr instanceof RateLimitError || sendErr instanceof ValidationError) {
          throw sendErr;
        }

        // Log actual delivery error safely without leaking OTP
        req.log.error(
          { contactType: normalized.type, error: sendErr.message },
          'Failed to dispatch OTP delivery'
        );

        return res.status(500).json({
          error: {
            code: 'OTP_DELIVERY_FAILED',
            message: 'Unable to deliver verification code at this time. Please try again later.',
          },
          reqId: req.id || 'unknown',
        });
      }

      // Generic response regardless of whether user exists
      res.status(200).json({
        success: true,
        message: 'If the contact is valid, a verification code has been sent.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/otp/verify
   * Verifies OTP, finds or creates user without profile data, sets session cookie.
   */
  async verifyOtp(req, res, next) {
    let contactType = 'unknown';
    try {
      const { contact, code } = req.body;
      const normalized = normalizeContact(contact);
      contactType = normalized.type;

      // Verify OTP code (constant-time comparison, expiry & attempt checks)
      try {
        await otpService.verifyOtp(normalized.contact, code);
      } catch (verifyErr) {
        req.log.info(
          {
            contactType,
            reason: verifyErr.message,
            code: verifyErr.code || 'OTP_VERIFICATION_FAILED',
          },
          'OTP verification attempt failed'
        );
        throw verifyErr;
      }

      // Find or create user
      let result;
      try {
        result = await userService.findOrCreateUser(normalized);
      } catch (userErr) {
        req.log.info(
          {
            contactType,
            reason: userErr.message,
            code: userErr.code || 'USER_RESOLUTION_FAILED',
          },
          'User resolution failed during OTP verify'
        );
        throw userErr;
      }

      const { user, isNewUser } = result;

      req.log.info(
        {
          contactType,
          userId: user.id,
          isNewUser,
        },
        'OTP verification succeeded'
      );

      // Issue 7-day JWT session token
      const sessionToken = tokenService.generateSessionToken(user.id);

      // Set httpOnly session cookie
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getCookieOptions(),
        maxAge: COOKIE_MAX_AGE_MS,
      });

      res.status(200).json({
        success: true,
        user,
        isNewUser,
      });
    } catch (err) {
      if (!['OTP_VERIFICATION_FAILED', 'USER_RESOLUTION_FAILED'].includes(err.code)) {
        req.log.info(
          {
            contactType,
            reason: err.message,
            code: err.code || 'VERIFY_REQUEST_FAILED',
          },
          'OTP verify request failed'
        );
      }
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user.
   */
  async getMe(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        user: req.user,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/auth/me
   * Updates current user's profile (name, role, location, preferredLanguage, secondaryContact).
   */
  async updateMe(req, res, next) {
    try {
      const { name, role, location, preferredLanguage, secondaryContact } = req.body;
      const updatedUser = await userService.updateUserProfile(req.user.id, {
        name,
        role,
        location,
        preferredLanguage,
        secondaryContact,
      });

      res.status(200).json({
        success: true,
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   * Clears httpOnly session cookie using identical path, sameSite, secure, and httpOnly flags.
   */
  async logout(req, res, next) {
    try {
      res.clearCookie(COOKIE_NAME, getCookieOptions());
      res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/link/request
   * Requests linking of secondary contact type (email or phone).
   */
  async requestLink(req, res, next) {
    try {
      const { contact } = req.body;
      const normalized = normalizeContact(contact);

      const userDoc = await userService.findUserById(req.user.id);
      await userService.verifyCanLinkContact(userDoc, normalized);

      try {
        await otpService.generateAndSendOtp(normalized.contact, normalized.type);
      } catch (sendErr) {
        if (sendErr instanceof RateLimitError || sendErr instanceof ValidationError) {
          throw sendErr;
        }

        req.log.error(
          { contactType: normalized.type, error: sendErr.message },
          'Failed to dispatch link verification OTP'
        );

        return res.status(500).json({
          error: {
            code: 'OTP_DELIVERY_FAILED',
            message: 'Unable to deliver verification code at this time. Please try again later.',
          },
          reqId: req.id || 'unknown',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Verification code sent to secondary contact.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/link/verify
   * Verifies secondary contact OTP and links it to account (re-verifying 409 check at verify time).
   */
  async verifyLink(req, res, next) {
    try {
      const { contact, code } = req.body;
      const normalized = normalizeContact(contact);

      // Verify OTP code
      await otpService.verifyOtp(normalized.contact, code);

      // Link contact to current user (re-executes 409 duplicate check)
      const updatedUser = await userService.linkContactToUser(req.user.id, normalized);

      res.status(200).json({
        success: true,
        user: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
export default authController;

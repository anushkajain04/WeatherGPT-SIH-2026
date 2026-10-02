import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import validate from '../middleware/validate.middleware.js';
import requireAuth from '../middleware/require-auth.middleware.js';
import csrfHeaderMiddleware from '../middleware/csrf-header.middleware.js';
import otpIpRateLimiter from '../middleware/otp-rate-limit.middleware.js';
import {
  otpRequestSchema,
  otpVerifySchema,
  updateProfileSchema,
  linkContactRequestSchema,
  linkContactVerifySchema,
} from '../validators/auth.validator.js';

export const authRouter = Router();

// 1. Passwordless OTP Request (IP rate limited, CSRF protected, enumeration-safe)
authRouter.post(
  '/otp/request',
  otpIpRateLimiter,
  csrfHeaderMiddleware,
  validate(otpRequestSchema, 'body'),
  (req, res, next) => authController.requestOtp(req, res, next)
);

// 2. Passwordless OTP Verification & Session Issuance
authRouter.post(
  '/otp/verify',
  otpIpRateLimiter,
  csrfHeaderMiddleware,
  validate(otpVerifySchema, 'body'),
  (req, res, next) => authController.verifyOtp(req, res, next)
);

// 3. Current Authenticated User Profile
authRouter.get('/me', requireAuth, (req, res, next) => authController.getMe(req, res, next));

// 4. Update Current User Profile (role, location, preferredLanguage)
authRouter.patch(
  '/me',
  requireAuth,
  csrfHeaderMiddleware,
  validate(updateProfileSchema, 'body'),
  (req, res, next) => authController.updateMe(req, res, next)
);

// 5. Logout (clears session cookie)
authRouter.post(
  '/logout',
  csrfHeaderMiddleware,
  (req, res, next) => authController.logout(req, res, next)
);

// 6. Secondary Contact Link Request (requires authenticated session)
authRouter.post(
  '/link/request',
  requireAuth,
  otpIpRateLimiter,
  csrfHeaderMiddleware,
  validate(linkContactRequestSchema, 'body'),
  (req, res, next) => authController.requestLink(req, res, next)
);

// 7. Secondary Contact Link Verification (requires authenticated session)
authRouter.post(
  '/link/verify',
  requireAuth,
  otpIpRateLimiter,
  csrfHeaderMiddleware,
  validate(linkContactVerifySchema, 'body'),
  (req, res, next) => authController.verifyLink(req, res, next)
);

export default authRouter;

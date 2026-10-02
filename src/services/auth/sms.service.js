import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

/**
 * Sends a 6-digit OTP code to the recipient mobile number.
 *
 * @param {object} params
 * @param {string} params.to - Normalized Indian phone number (+91XXXXXXXXXX)
 * @param {string} params.code - 6-digit OTP code
 */
export async function sendSmsOtp({ to, code }) {
  if (env.SMS_PROVIDER === 'console') {
    console.log('\n========================================');
    console.log(`[DEV SMS] OTP for ${to}: ${code}`);
    console.log('========================================\n');
    return { success: true };
  }

  if (env.SMS_PROVIDER === 'custom') {
    /**
     * =========================================================================
     * PRODUCTION SMS GATEWAY STUB (e.g. Twilio / Gupshup / MSG91 / AWS SNS)
     * =========================================================================
     * When ready for production SMS delivery:
     * 1. Initialize your SMS vendor SDK (e.g., twilio(accountSid, authToken))
     * 2. Call the provider API:
     *    await client.messages.create({
     *      body: `Your WeatherGPT verification code is: ${code}. Valid for 5 minutes.`,
     *      from: env.TWILIO_PHONE_NUMBER,
     *      to,
     *    });
     * =========================================================================
     */
    throw new AppError(
      'SMS gateway provider is not configured. Please configure an active SMS provider driver.',
      500,
      'SMS_NOT_CONFIGURED'
    );
  }

  throw new AppError('Unknown SMS provider configured.', 500, 'SMS_PROVIDER_ERROR');
}

export default { sendSmsOtp };

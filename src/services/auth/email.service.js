import nodemailer from 'nodemailer';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

let transporter = null;

function getTransporter() {
  if (!transporter && env.MAIL_PROVIDER === 'smtp') {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Sends a 6-digit OTP code to the recipient email.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.code - 6-digit OTP code
 */
export async function sendEmailOtp({ to, code }) {
  if (env.MAIL_PROVIDER === 'console') {
    console.log('\n========================================');
    console.log(`[DEV MAIL] OTP for ${to}: ${code}`);
    console.log('========================================\n');
    return { success: true };
  }

  if (env.MAIL_PROVIDER === 'smtp') {
    try {
      const client = getTransporter();
      if (!client) {
        throw new Error('SMTP transporter is not configured properly.');
      }

      await client.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject: 'WeatherGPT Verification Code',
        text: `Your WeatherGPT verification code is: ${code}. This code expires in 5 minutes. If you did not request this, please ignore this email.`,
        html: `<p>Your WeatherGPT verification code is: <strong>${code}</strong></p><p>This code will expire in 5 minutes. If you did not request this, please ignore this message.</p>`,
      });

      logger.info({ to }, 'Email OTP sent via SMTP successfully.');
      return { success: true };
    } catch (err) {
      logger.error({ to, error: err.message }, 'Failed to send email via SMTP.');
      throw new AppError('Failed to send verification email.', 500, 'EMAIL_SEND_FAILED');
    }
  }

  throw new AppError('Unknown email provider configured.', 500, 'MAIL_PROVIDER_ERROR');
}

export default { sendEmailOtp };

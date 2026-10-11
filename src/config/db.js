import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';
import User from '../models/user.model.js';
import Otp from '../models/otp.model.js';
import OtpLockout from '../models/otp-lockout.model.js';

let isConnected = false;

/**
 * Connect to MongoDB Atlas and synchronize indexes.
 */
export async function connectDB() {
  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      autoIndex: false, // Don't build indexes automatically in production queries
    });

    isConnected = true;
    logger.info({ host: conn.connection.host }, 'MongoDB Atlas connected successfully.');

    // Ensure partial unique indexes and TTL indexes are explicitly created/synchronized at startup
    await Promise.all([User.syncIndexes(), Otp.syncIndexes(), OtpLockout.syncIndexes()]);
    const userIndexes = await User.collection.indexes();
    const hasEmailUnique = userIndexes.some((idx) => idx.name === 'email_1' && idx.unique);
    const hasPhoneUnique = userIndexes.some((idx) => idx.name === 'phone_1' && idx.unique);
    logger.info(
      { hasEmailUnique, hasPhoneUnique },
      'Database indexes synchronized and verified successfully.'
    );
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to connect to MongoDB.');
    throw err;
  }
}

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDB() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected cleanly.');
  } catch (err) {
    logger.error({ error: err.message }, 'Error during MongoDB disconnection.');
  }
}

export default { connectDB, disconnectDB };

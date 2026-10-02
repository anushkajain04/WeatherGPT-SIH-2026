import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';
import User from '../models/user.model.js';
import Otp from '../models/otp.model.js';

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
    await Promise.all([User.syncIndexes(), Otp.syncIndexes()]);
    logger.info('Database indexes synchronized successfully.');
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

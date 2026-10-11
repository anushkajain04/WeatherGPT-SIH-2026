import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

/**
 * Global centralized Express error handler.
 * Sanitizes errors, formats client responses, and ensures secrets never leak.
 */
export function errorHandler(err, req, res, next) {
  const reqLogger = req.log || logger;
  const reqId = req.id || 'unknown';

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred. Please try again later.';
  let details = null;

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 422;
    code = 'UPLOAD_ERROR';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Audio file exceeds the maximum 5MB size limit.';
    } else {
      message = `File upload error: ${err.message}`;
    }
  } else if (err.type === 'entity.too.large') {
    // Handle body-parser payload too large (10kb limit)
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload exceeds the 10KB size limit.';
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    // Handle malformed JSON
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed JSON payload provided.';
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;

    // Log internal server log message if present (e.g., for RAG 401 key rejection)
    if (err.serverLog) {
      reqLogger.error({ reqId, code, serverLog: err.serverLog }, err.serverLog);
    }
  } else {
    // Unhandled exception
    reqLogger.error({ reqId, err: err.message, stack: err.stack }, 'Unhandled error occurred');
  }

  // Ensure operational errors are logged with warning/info while 5xx are logged with error
  if (statusCode >= 500 && !err.serverLog) {
    reqLogger.error({ reqId, statusCode, code, errMessage: err.message }, 'Server error response sent');
  } else if (statusCode >= 400 && statusCode < 500) {
    reqLogger.warn({ reqId, statusCode, code, message, details }, 'Client error response sent');
  }

  const responseBody = {
    error: {
      code,
      message,
      ...(details ? { details, fields: details } : {}),
    },
    reqId,
  };

  // Attach stack trace only in development and non-operational errors
  if (env.NODE_ENV === 'development' && !(err instanceof AppError)) {
    responseBody.error.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}

export default errorHandler;


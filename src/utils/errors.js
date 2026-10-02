/**
 * Custom typed error classes per subsystem.
 *
 * Enforces safe client-facing messages and prevents internal/upstream
 * details, stack traces, and API keys from leaking to users.
 */

export class AppError extends Error {
  /**
   * @param {string} message - Safe message presented to the client
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Machine-readable error code
   * @param {any} [details=null] - Additional contextual details (sanitized)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnsupportedLanguageError extends AppError {
  constructor(language) {
    super(
      `Language '${language}' is not supported. Only the 22 scheduled Indian languages and English are supported.`,
      422,
      'UNSUPPORTED_LANGUAGE',
      { language }
    );
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please slow down and try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Upstream Python RAG service errors.
 * Maps upstream status codes (400, 401, 503, timeouts) to safe client responses.
 */
export class RAGServiceError extends AppError {
  /**
   * @param {object} params
   * @param {number} [params.upstreamStatus]
   * @param {boolean} [params.isTimeout=false]
   * @param {string} [params.internalMessage] - Recorded in server logs only, NEVER sent to client
   */
  constructor({ upstreamStatus, isTimeout = false, internalMessage = '' }) {
    let clientMessage = 'Weather service is temporarily unavailable. Please try again later.';
    let statusCode = 502;
    let code = 'RAG_SERVICE_ERROR';
    let serverLog = internalMessage;

    if (isTimeout) {
      statusCode = 504;
      clientMessage = 'Weather service is waking up, please try again in a few seconds.';
      code = 'RAG_GATEWAY_TIMEOUT';
    } else if (upstreamStatus === 400) {
      statusCode = 400;
      clientMessage = 'Unable to resolve location. Please confirm your city and try again.';
      code = 'LOCATION_UNRESOLVABLE';
    } else if (upstreamStatus === 401) {
      statusCode = 502;
      clientMessage = 'Weather service configuration error. Please contact support.';
      code = 'RAG_AUTH_ERROR';
      serverLog = 'CRITICAL: Internal RAG API key was rejected by the upstream RAG service (401).';
    } else if (upstreamStatus === 503) {
      statusCode = 503;
      clientMessage = 'Our AI systems are currently busy, please try again later.';
      code = 'AI_SYSTEMS_BUSY';
    }

    super(clientMessage, statusCode, code);
    this.upstreamStatus = upstreamStatus;
    this.serverLog = serverLog;
  }
}

/**
 * Subsystem errors for Bhashini (Translation, ASR, TTS, TLD).
 * Keeps Bhashini failures clearly distinct from weather/RAG failures.
 */
export class BhashiniError extends AppError {
  constructor(message = 'Language processing service temporarily unavailable', code = 'BHASHINI_ERROR', details = null) {
    super(message, 502, code, details);
  }
}

export class NMTError extends BhashiniError {
  constructor(message = 'Translation service error', details = null) {
    super(message, 'NMT_ERROR', details);
  }
}

export class ASRError extends BhashiniError {
  constructor(message = 'Speech-to-text processing failed', details = null) {
    super(message, 'ASR_ERROR', details);
  }
}

export class TTSError extends BhashiniError {
  constructor(message = 'Text-to-speech synthesis failed', details = null) {
    super(message, 'TTS_ERROR', details);
  }
}

export class LanguageDetectionError extends BhashiniError {
  constructor(message = 'Language detection failed', details = null) {
    super(message, 'TLD_ERROR', details);
  }
}


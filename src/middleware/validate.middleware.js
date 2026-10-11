import { ValidationError } from '../utils/errors.js';

/**
 * Creates an Express middleware that validates a request property (body, query, params)
 * against a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [target='body']
 */
export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      const summary = fieldErrors
        .map((f) => (f.field ? `${f.field}: ${f.message}` : f.message))
        .join('; ');

      return next(new ValidationError(`Input validation failed: ${summary}`, fieldErrors));
    }

    // Assign sanitized and parsed values back to request
    req[target] = result.data;
    next();
  };
}

export default validate;


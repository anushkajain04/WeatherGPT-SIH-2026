import { Router } from 'express';
import geocodingController from '../controllers/geocoding.controller.js';
import validate from '../middleware/validate.middleware.js';
import { resolveLocationQuerySchema } from '../validators/geocoding.validator.js';
import geocodingRateLimiter from '../middleware/geocoding-rate-limit.middleware.js';

export const geocodingRouter = Router();

// GET /api/city/resolve?lat=<number>&lon=<number>
geocodingRouter.get(
  '/resolve',
  geocodingRateLimiter,
  validate(resolveLocationQuerySchema, 'query'),
  (req, res, next) => geocodingController.resolveCity(req, res, next)
);

export default geocodingRouter;

import { Router } from 'express';
import geocodingController from '../controllers/geocoding.controller.js';
import validate from '../middleware/validate.middleware.js';
import {
  resolveLocationQuerySchema,
  resolvePincodeQuerySchema,
  searchPlacesQuerySchema,
} from '../validators/geocoding.validator.js';
import geocodingRateLimiter from '../middleware/geocoding-rate-limit.middleware.js';

export const geocodingRouter = Router();

// GET /api/city/resolve?lat=<number>&lon=<number>
geocodingRouter.get(
  '/resolve',
  geocodingRateLimiter,
  validate(resolveLocationQuerySchema, 'query'),
  (req, res, next) => geocodingController.resolveCity(req, res, next)
);

// GET /api/city/resolve-pincode?pincode=<6-digit>
geocodingRouter.get(
  '/resolve-pincode',
  geocodingRateLimiter,
  validate(resolvePincodeQuerySchema, 'query'),
  (req, res, next) => geocodingController.resolvePincode(req, res, next)
);

// GET /api/city/search?q=<string>
geocodingRouter.get(
  '/search',
  geocodingRateLimiter,
  validate(searchPlacesQuerySchema, 'query'),
  (req, res, next) => geocodingController.searchPlaces(req, res, next)
);

export default geocodingRouter;

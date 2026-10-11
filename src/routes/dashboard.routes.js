import { Router } from 'express';
import { z } from 'zod';
import dashboardController from '../controllers/dashboard.controller.js';
import geocodingRateLimiter from '../middleware/geocoding-rate-limit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

export const dashboardRouter = Router();

const dashboardQuerySchema = z.object({
  location: z.string().trim().optional(),
  role: z.string().trim().optional(),
  lat: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? undefined : Number(v)),
    z.number().min(-90).max(90).optional()
  ),
  lon: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? undefined : Number(v)),
    z.number().min(-180).max(180).optional()
  ),
});

// GET /api/dashboard?location=<string>&role=<string>&lat=<number>&lon=<number>
dashboardRouter.get(
  '/',
  geocodingRateLimiter,
  validate(dashboardQuerySchema, 'query'),
  (req, res, next) => dashboardController.getDashboard(req, res, next)
);

export default dashboardRouter;

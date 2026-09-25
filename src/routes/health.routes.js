import { Router } from 'express';
import healthController from '../controllers/health.controller.js';

export const healthRouter = Router();

// GET /api/health — own liveness plus cached upstream check
healthRouter.get('/health', (req, res, next) => healthController.getHealth(req, res, next));

// GET /api/status — per-subsystem health (RAG, Bhashini config, NMT)
healthRouter.get('/status', (req, res, next) => healthController.getStatus(req, res, next));

export default healthRouter;


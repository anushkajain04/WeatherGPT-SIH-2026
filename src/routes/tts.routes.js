import { Router } from 'express';
import ttsController from '../controllers/tts.controller.js';
import { ttsBodySchema } from '../validators/tts.validator.js';
import validate from '../middleware/validate.middleware.js';
import authMiddleware from '../middleware/auth.middleware.js';

export const ttsRouter = Router();

// POST /api/tts — on-demand speech synthesis
ttsRouter.post(
  '/tts',
  authMiddleware,
  validate(ttsBodySchema, 'body'),
  (req, res, next) => ttsController.handleTTS(req, res, next)
);

export default ttsRouter;


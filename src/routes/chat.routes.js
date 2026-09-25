import { Router } from 'express';
import multer from 'multer';
import chatController from '../controllers/chat.controller.js';
import { chatBodySchema, voiceChatBodySchema } from '../validators/chat.validator.js';
import validate from '../middleware/validate.middleware.js';
import chatRateLimiter from '../middleware/rate-limit.middleware.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { AUDIO_CONSTRAINTS } from '../config/constants.js';
import { ValidationError } from '../utils/errors.js';

export const chatRouter = Router();

// Configure Multer for memory storage with 5MB cap and strict mime filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AUDIO_CONSTRAINTS.MAX_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (AUDIO_CONSTRAINTS.ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Invalid audio file format '${file.mimetype}'. Only WAV and MP3 files are allowed.`
        ),
        false
      );
    }
  },
});

// POST /api/chat — text-based multilingual chat
chatRouter.post(
  '/chat',
  chatRateLimiter,
  authMiddleware,
  validate(chatBodySchema, 'body'),
  (req, res, next) => chatController.handleChat(req, res, next)
);

// POST /api/chat/voice — audio-based multilingual chat with ASR
chatRouter.post(
  '/chat/voice',
  chatRateLimiter,
  authMiddleware,
  upload.single('audio'),
  validate(voiceChatBodySchema, 'body'),
  (req, res, next) => chatController.handleVoiceChat(req, res, next)
);

export default chatRouter;


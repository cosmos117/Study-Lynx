import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { aiGenerationRateLimiter } from '../middleware/aiRateLimiters.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ask } from '../controllers/tutorController.js';
import { tutorAskSchema } from '../schemas/ragSchemas.js';

const router = Router();
router.use(authMiddleware);
router.post('/ask', aiGenerationRateLimiter, validate(tutorAskSchema), asyncHandler(ask));
export default router;
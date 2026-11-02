import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { aiGenerationRateLimiter } from '../middleware/aiRateLimiters.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ask, clearHistory, history } from '../controllers/tutorController.js';
import { tutorAskSchema, tutorHistoryQuerySchema } from '../schemas/ragSchemas.js';

const router = Router();
router.use(authMiddleware);
router.post('/ask', aiGenerationRateLimiter, validate(tutorAskSchema), asyncHandler(ask));
router.get('/history', validate(tutorHistoryQuerySchema, 'query'), asyncHandler(history));
router.delete('/history', validate(tutorHistoryQuerySchema, 'query'), asyncHandler(clearHistory));
export default router;
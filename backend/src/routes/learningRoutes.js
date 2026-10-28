import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { aiGenerationRateLimiter } from '../middleware/aiRateLimiters.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { flashcards, mindmap, notes, quiz, recall } from '../controllers/learningController.js';
import { usage } from '../controllers/aiController.js';
import {
  aiGenerateSchema, dueQuerySchema, flashcardIdSchema, flashcardSchema, noteSaveSchema, quizSubmitSchema, reviewSchema, topicAiParamsSchema,
} from '../schemas/aiSchemas.js';

const router = Router();
router.use(authMiddleware);
router.get('/ai/usage', asyncHandler(usage));
router.get('/recall/summary', asyncHandler(recall.summary));
const topic = [validate(topicAiParamsSchema, 'params')];
const generate = [aiGenerationRateLimiter, validate(aiGenerateSchema)];

router.get('/topics/:topicId/notes', ...topic, asyncHandler(notes.get));
router.post('/topics/:topicId/notes/generate', ...topic, ...generate, asyncHandler(notes.generate));
router.put('/topics/:topicId/notes', ...topic, validate(noteSaveSchema), asyncHandler(notes.save));

router.get('/topics/:topicId/flashcards', ...topic, asyncHandler(flashcards.list));
router.post('/topics/:topicId/flashcards/generate', ...topic, ...generate, asyncHandler(flashcards.generate));
router.post('/topics/:topicId/flashcards', ...topic, validate(flashcardSchema), asyncHandler(flashcards.create));
router.put('/flashcards/:id', validate(flashcardIdSchema, 'params'), validate(flashcardSchema), asyncHandler(flashcards.update));
router.delete('/flashcards/:id', validate(flashcardIdSchema, 'params'), asyncHandler(flashcards.remove));
router.get('/flashcards/due', validate(dueQuerySchema, 'query'), asyncHandler(flashcards.due));
router.post('/flashcards/:id/review', validate(flashcardIdSchema, 'params'), validate(reviewSchema), asyncHandler(flashcards.review));

router.get('/topics/:topicId/quiz', ...topic, asyncHandler(quiz.get));
router.post('/topics/:topicId/quiz/generate', ...topic, ...generate, asyncHandler(quiz.generate));
router.post('/topics/:topicId/quiz/submit', ...topic, validate(quizSubmitSchema), asyncHandler(quiz.submit));

router.get('/topics/:topicId/mindmap', ...topic, asyncHandler(mindmap.get));
router.post('/topics/:topicId/mindmap/generate', ...topic, ...generate, asyncHandler(mindmap.generate));

export default router;

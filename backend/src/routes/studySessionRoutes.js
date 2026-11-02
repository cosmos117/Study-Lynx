import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { complete, skip } from '../controllers/studySessionController.js';
import { completeSessionSchema, sessionIdSchema } from '../schemas/studySessionSchemas.js';

// Sessions are started by the Pomodoro through POST /topics/:topicId/study-now (topicHubRoutes).
const router = Router();
router.use(authMiddleware);
router.post('/:id/complete', validate(sessionIdSchema, 'params'), validate(completeSessionSchema), asyncHandler(complete));
router.post('/:id/skip', validate(sessionIdSchema, 'params'), asyncHandler(skip));
export default router;

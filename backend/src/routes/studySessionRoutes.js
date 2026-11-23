import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { complete, focus, skip } from '../controllers/studySessionController.js';
import { completeSessionSchema, sessionIdSchema, studyNowSchema } from '../schemas/studySessionSchemas.js';

// The Pomodoro starts a session through POST /topics/:topicId/study-now (topicHubRoutes), or here,
// through POST /focus, when the student starts a focus block without choosing a topic.
const router = Router();
router.use(authMiddleware);
router.post('/focus', validate(studyNowSchema), asyncHandler(focus));
router.post('/:id/complete', validate(sessionIdSchema, 'params'), validate(completeSessionSchema), asyncHandler(complete));
router.post('/:id/skip', validate(sessionIdSchema, 'params'), asyncHandler(skip));
export default router;

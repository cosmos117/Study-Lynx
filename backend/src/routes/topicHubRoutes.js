import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getHub, startStudying } from '../controllers/topicHubController.js';
import { topicAiParamsSchema } from '../schemas/aiSchemas.js';
import { studyNowSchema } from '../schemas/studySessionSchemas.js';

const router = Router();
router.use(authMiddleware);
router.get('/topics/:topicId/hub', validate(topicAiParamsSchema, 'params'), asyncHandler(getHub));
router.post('/topics/:topicId/study-now', validate(topicAiParamsSchema, 'params'), validate(studyNowSchema), asyncHandler(startStudying));
export default router;

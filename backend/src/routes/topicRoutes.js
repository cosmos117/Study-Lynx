import { Router } from 'express';
import { create, remove } from '../controllers/topicController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createTopicSchema, subjectIdSchema, topicIdSchema } from '../schemas/topicSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Topics are listed with their subject (GET /subjects) and opened through the topic hub.
const router = Router();

router.use(['/subjects', '/topics'], authMiddleware);
router.post(
  '/subjects/:subjectId/topics',
  validate(subjectIdSchema, 'params'),
  validate(createTopicSchema),
  asyncHandler(create),
);
router.delete(
  '/topics/:id',
  validate(topicIdSchema, 'params'),
  asyncHandler(remove),
);

export default router;

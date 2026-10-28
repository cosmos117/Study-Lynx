import { Router } from 'express';
import { create, list, remove, update } from '../controllers/topicController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createTopicSchema,
  subjectIdSchema,
  topicIdSchema,
  updateTopicSchema,
} from '../schemas/topicSchemas.js';
import { paginationQuerySchema } from '../schemas/commonSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authMiddleware);
router.post(
  '/subjects/:subjectId/topics',
  validate(subjectIdSchema, 'params'),
  validate(createTopicSchema),
  asyncHandler(create),
);
router.get(
  '/subjects/:subjectId/topics',
  validate(subjectIdSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  asyncHandler(list),
);
router.put(
  '/topics/:id',
  validate(topicIdSchema, 'params'),
  validate(updateTopicSchema),
  asyncHandler(update),
);
router.delete(
  '/topics/:id',
  validate(topicIdSchema, 'params'),
  asyncHandler(remove),
);

export default router;

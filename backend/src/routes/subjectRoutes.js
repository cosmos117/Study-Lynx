import { Router } from 'express';
import { create, list, remove, update } from '../controllers/subjectController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createSubjectSchema,
  examIdSchema,
  subjectIdSchema,
  updateSubjectSchema,
} from '../schemas/subjectSchemas.js';
import { paginationQuerySchema } from '../schemas/commonSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authMiddleware);
router.post(
  '/exams/:examId/subjects',
  validate(examIdSchema, 'params'),
  validate(createSubjectSchema),
  asyncHandler(create),
);
router.get(
  '/exams/:examId/subjects',
  validate(examIdSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  asyncHandler(list),
);
router.put(
  '/subjects/:id',
  validate(subjectIdSchema, 'params'),
  validate(updateSubjectSchema),
  asyncHandler(update),
);
router.delete(
  '/subjects/:id',
  validate(subjectIdSchema, 'params'),
  asyncHandler(remove),
);

export default router;

import { Router } from 'express';
import { create, get, list, remove, update } from '../controllers/examController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createExamSchema,
  examIdSchema,
  updateExamSchema,
} from '../schemas/examSchemas.js';
import { paginationQuerySchema } from '../schemas/commonSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authMiddleware);
router.post('/', validate(createExamSchema), asyncHandler(create));
router.get('/', validate(paginationQuerySchema, 'query'), asyncHandler(list));
router.get('/:id', validate(examIdSchema, 'params'), asyncHandler(get));
router.put(
  '/:id',
  validate(examIdSchema, 'params'),
  validate(updateExamSchema),
  asyncHandler(update),
);
router.delete('/:id', validate(examIdSchema, 'params'), asyncHandler(remove));

export default router;

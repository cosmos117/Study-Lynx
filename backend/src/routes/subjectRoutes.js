import { Router } from 'express';
import { create, list, remove, update } from '../controllers/subjectController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { createSubjectSchema, subjectIdSchema, updateSubjectSchema } from '../schemas/subjectSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authMiddleware);
router.get('/subjects', asyncHandler(list));
router.post('/subjects', validate(createSubjectSchema), asyncHandler(create));
router.put(
  '/subjects/:id',
  validate(subjectIdSchema, 'params'),
  validate(updateSubjectSchema),
  asyncHandler(update),
);
router.delete('/subjects/:id', validate(subjectIdSchema, 'params'), asyncHandler(remove));

export default router;

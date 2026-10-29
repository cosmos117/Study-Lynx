import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { complete, create, listRange, listToday, skip, start, update } from '../controllers/studySessionController.js';
import { completeSessionSchema, createSessionSchema, sessionIdSchema, sessionQuerySchema, updateSessionSchema } from '../schemas/studySessionSchemas.js';

const router = Router();
router.use(authMiddleware);
router.get('/today', validate(sessionQuerySchema, 'query'), asyncHandler(listToday));
router.get('/', validate(sessionQuerySchema, 'query'), asyncHandler(listRange));
router.post('/', validate(createSessionSchema), asyncHandler(create));
router.patch('/:id', validate(sessionIdSchema, 'params'), validate(updateSessionSchema), asyncHandler(update));
router.post('/:id/start', validate(sessionIdSchema, 'params'), asyncHandler(start));
router.post('/:id/complete', validate(sessionIdSchema, 'params'), validate(completeSessionSchema), asyncHandler(complete));
router.post('/:id/skip', validate(sessionIdSchema, 'params'), asyncHandler(skip));
export default router;

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createYoutube, get, list, progress, remove } from '../controllers/resourceController.js';
import { resourceIdSchema, resourceProgressSchema, resourceQuerySchema, youtubeResourceSchema } from '../schemas/resourceSchemas.js';

const router = Router();
router.use(authMiddleware);
router.get('/', validate(resourceQuerySchema, 'query'), asyncHandler(list));
router.get('/:id', validate(resourceIdSchema, 'params'), asyncHandler(get));
router.post('/youtube', validate(youtubeResourceSchema), asyncHandler(createYoutube));
router.patch('/:id/progress', validate(resourceIdSchema, 'params'), validate(resourceProgressSchema), asyncHandler(progress));
router.delete('/:id', validate(resourceIdSchema, 'params'), asyncHandler(remove));
export default router;

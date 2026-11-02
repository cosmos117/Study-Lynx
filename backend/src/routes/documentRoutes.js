import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDocument } from '../middleware/uploadMiddleware.js';
import { upload, createText, remove } from '../controllers/documentController.js';
import { documentIdSchema, documentTextSchema, documentUploadSchema } from '../schemas/ragSchemas.js';

const router = Router();
router.use(authMiddleware);
router.post('/', uploadDocument.single('file'), validate(documentUploadSchema), asyncHandler(upload));
router.post('/text', validate(documentTextSchema), asyncHandler(createText));
router.delete('/:id', validate(documentIdSchema, 'params'), asyncHandler(remove));
export default router;

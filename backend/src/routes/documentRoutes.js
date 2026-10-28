import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadDocument } from '../middleware/uploadMiddleware.js';
import { upload, createText, list, get, chunks, remove, attach } from '../controllers/documentController.js';
import {
  documentIdSchema,
  documentQuerySchema,
  documentChunksQuerySchema,
  documentUploadSchema,
  documentAttachSchema,
  documentTextSchema,
} from '../schemas/ragSchemas.js';

const router = Router();
router.use(authMiddleware);
router.post('/', uploadDocument.single('file'), validate(documentUploadSchema), asyncHandler(upload));
router.post('/text', validate(documentTextSchema), asyncHandler(createText));
router.get('/', validate(documentQuerySchema, 'query'), asyncHandler(list));
router.get('/:id', validate(documentIdSchema, 'params'), asyncHandler(get));
router.get('/:id/chunks', validate(documentIdSchema, 'params'), validate(documentChunksQuerySchema, 'query'), asyncHandler(chunks));
router.delete('/:id', validate(documentIdSchema, 'params'), asyncHandler(remove));
router.patch('/:id/topic', validate(documentIdSchema, 'params'), validate(documentAttachSchema), asyncHandler(attach));
export default router;

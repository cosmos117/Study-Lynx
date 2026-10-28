import multer from 'multer';
import { env } from '../config/env.js';

/**
 * Multer configuration for document uploads.
 * Files are held in memory (bounded by maxFileSizeBytes) and written to disk
 * by the ingestion service, keeping route handlers free of storage concerns.
 */
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.rag.maxFileSizeBytes },
  fileFilter: (_request, file, callback) => {
    if (env.rag.allowedMimeTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Unsupported file type'), false);
    }
  },
});
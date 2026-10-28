import { Router } from 'express';
import { summary } from '../controllers/dashboardController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/summary', authMiddleware, asyncHandler(summary));

export default router;

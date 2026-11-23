import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { insightsService } from '../services/insightsService.js';

const router = Router();
router.use('/overview', authMiddleware);
router.get('/overview', asyncHandler(async (request, response) => {
  response.json({ success: true, data: await insightsService.getOverview(request.user.id) });
}));
export default router;

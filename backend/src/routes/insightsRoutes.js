import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { insightsService } from '../services/insightsService.js';

const analyticsQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(90).default(14) });

const router = Router();
router.use(authMiddleware);
router.get('/overview', asyncHandler(async (request, response) => {
  response.json({ success: true, data: await insightsService.getOverview(request.user.id) });
}));
router.get('/analytics', validate(analyticsQuerySchema, 'query'), asyncHandler(async (request, response) => {
  response.json({ success: true, data: await insightsService.getAnalytics(request.user.id, request.query.days) });
}));
export default router;

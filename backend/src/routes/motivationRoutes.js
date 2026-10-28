import { Router } from 'express';
import { today } from '../controllers/motivationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();
router.get('/today', authMiddleware, today);
export default router;

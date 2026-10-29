import { Router } from 'express';
import { googleLogin, login, me, register } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validateMiddleware.js';
import { googleLoginSchema, loginSchema, registerSchema } from '../schemas/authSchemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(login));
router.post('/google', authRateLimiter, validate(googleLoginSchema), asyncHandler(googleLogin));
router.get('/me', authMiddleware, asyncHandler(me));

export default router;

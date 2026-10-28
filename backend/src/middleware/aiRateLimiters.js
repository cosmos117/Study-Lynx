import rateLimit from 'express-rate-limit';

export const aiGenerationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI generation requests. Please try again later.', code: 'AI_LIMIT_REACHED' },
});

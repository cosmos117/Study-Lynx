import { verifyToken } from '../utils/jwt.js';
import { createHttpError } from '../utils/httpError.js';

export function authMiddleware(request, _response, next) {
  const authorization = request.headers.authorization;
  const [scheme, token] = authorization?.split(' ') || [];

  if (scheme !== 'Bearer' || !token) {
    return next(createHttpError(401, 'Authentication token is required'));
  }

  try {
    const payload = verifyToken(token);
    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId < 1) {
      return next(createHttpError(401, 'Invalid authentication token'));
    }

    request.user = { id: userId };
    return next();
  } catch (_error) {
    return next(createHttpError(401, 'Invalid or expired authentication token'));
  }
}

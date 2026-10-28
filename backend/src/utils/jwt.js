import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function requireJwtSecret() {
  if (!env.jwtSecret || env.jwtSecret === 'CHANGE_THIS_SECRET') {
    throw new Error('JWT_SECRET must be configured before authentication is used');
  }

  return env.jwtSecret;
}

export function createToken(userId) {
  return jwt.sign(
    { sub: String(userId) },
    requireJwtSecret(),
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, requireJwtSecret());
}

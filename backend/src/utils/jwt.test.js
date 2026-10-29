import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

process.env.JWT_SECRET = 'test-secret-for-jwt-tests';

const { createToken, verifyToken } = await import('./jwt.js');

describe('jwt', () => {
  it('round-trips a user id', () => {
    expect(verifyToken(createToken(42)).sub).toBe('42');
  });

  it('rejects a token signed with a different algorithm', () => {
    const token = jwt.sign({ sub: '42' }, process.env.JWT_SECRET, { algorithm: 'HS512' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('rejects an unsigned token', () => {
    const token = jwt.sign({ sub: '42' }, '', { algorithm: 'none' });
    expect(() => verifyToken(token)).toThrow();
  });
});

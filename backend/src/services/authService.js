import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import prisma from '../config/prisma.js';
import { createToken } from '../utils/jwt.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { toSafeUser } from '../utils/user.js';
import { createHttpError } from '../utils/httpError.js';

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw createHttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: passwordHash,
    },
  });

  return {
    user: toSafeUser(user),
    token: createToken(user.id),
  };
}

export async function loginUser({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Google-only accounts have no password hash to compare against.
  if (!user || !user.password || !(await comparePassword(password, user.password))) {
    throw createHttpError(401, 'Invalid email or password');
  }

  return {
    user: toSafeUser(user),
    token: createToken(user.id),
  };
}

export async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createHttpError(401, 'User account no longer exists');
  }

  return toSafeUser(user);
}

let googleClient;

async function verifyGoogleCredential(credential) {
  if (!env.googleClientId) {
    throw createHttpError(503, 'Google sign-in is not configured');
  }
  googleClient ||= new OAuth2Client(env.googleClientId);

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw createHttpError(401, 'Invalid Google credential');
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw createHttpError(401, 'Your Google email address is not verified');
  }
  return payload;
}

export async function loginWithGoogle({ credential }) {
  const { sub, email, name } = await verifyGoogleCredential(credential);
  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findUnique({ where: { googleId: sub } });

  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Google verified this email, so it is safe to attach to an existing password account.
    user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { googleId: sub } })
      : await prisma.user.create({
        data: { name: (name || normalizedEmail.split('@')[0]).trim().slice(0, 100), email: normalizedEmail, googleId: sub },
      });
  }

  return {
    user: toSafeUser(user),
    token: createToken(user.id),
  };
}

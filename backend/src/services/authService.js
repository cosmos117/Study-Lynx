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

  if (!user || !(await comparePassword(password, user.password))) {
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

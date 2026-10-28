import { z } from 'zod';

const emailSchema = z.string().trim().email('A valid email is required').transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(320);
const password = z.string().min(8).max(128);

export const registerSchema = z.object({ email, password });
export const loginSchema = registerSchema;
export const refreshSchema = z.object({ refreshToken: z.string().trim().min(20) });

export const authUserSchema = z.object({
  id: z.string().min(1),
  email,
  role: z.enum(['FARMER', 'ADMIN']),
});

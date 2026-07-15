import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roleCodes: z.array(z.string().min(1)).default([]),
});

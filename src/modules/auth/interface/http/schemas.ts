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

export const setAdminUserActiveSchema = z.object({
  isActive: z.boolean(),
});

export const updateAdminUserRolesSchema = z.object({
  roleCodes: z.array(z.string().min(1)).default([]),
});

export const resetAdminUserPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

// A role "code" is a stable, machine-facing identifier (like a permission
// code) — lowercase, hyphenated, no spaces — distinct from its editable
// display "name".
export const createRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only (e.g. "catalog-editor").'),
  name: z.string().trim().min(1).max(100),
});

export const updateRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string().min(1)).default([]),
});

import { Router } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { env } from '../../config/env.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaAdminUserRepository } from './infrastructure/prisma-admin-user.repository.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { JwtTokenService } from './infrastructure/jwt-token.service.js';
import { Login } from './application/login.usecase.js';
import { CreateAdminUser } from './application/create-admin-user.usecase.js';
import { GetCurrentAdmin } from './application/get-current-admin.usecase.js';
import { authenticate, authorize } from './interface/http/auth.middleware.js';
import { loginSchema, createAdminUserSchema } from './interface/http/schemas.js';

export interface AuthModule {
  /** Unauthenticated routes (login) — mount BEFORE the authenticate middleware. */
  public: Router;
  /** Authenticated admin routes owned by this module (create more admins). */
  admin: Router;
  /** The middleware every other /admin/v1 route is protected by. */
  authenticate: ReturnType<typeof authenticate>;
  authorize: typeof authorize;
}

/** Composition root for Auth/RBAC. */
export function createAuthModule(db: Db): AuthModule {
  const adminUsers = new PrismaAdminUserRepository(db);
  const hasher = new ScryptPasswordHasher();
  const tokens = new JwtTokenService(env.JWT_SECRET);

  const login = new Login(adminUsers, hasher, tokens);
  const createAdminUser = new CreateAdminUser(adminUsers, hasher);
  const getCurrentAdmin = new GetCurrentAdmin(adminUsers);

  const publicRouter = Router();
  publicRouter.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const body = parse(loginSchema, req.body);
      res.json({ data: await login.execute(body) });
    }),
  );

  const admin = Router();
  // No authorize() — every authenticated admin may read their own identity;
  // this is what apps/admin's nav/UI permission gating reads from.
  admin.get(
    '/auth/me',
    asyncHandler(async (req, res) => {
      res.json({ data: await getCurrentAdmin.execute(req.adminUser!.adminUserPublicId, req.adminUser!.permissions) });
    }),
  );
  admin.post(
    '/auth/admin-users',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createAdminUserSchema, req.body);
      res.status(201).json({ data: await createAdminUser.execute(body) });
    }),
  );

  return { public: publicRouter, admin, authenticate: authenticate(tokens), authorize };
}

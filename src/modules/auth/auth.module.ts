import { Router, type Request } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { env } from '../../config/env.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaAdminUserRepository } from './infrastructure/prisma-admin-user.repository.js';
import { PrismaPermissionRepository } from './infrastructure/prisma-permission.repository.js';
import { PrismaRoleRepository } from './infrastructure/prisma-role.repository.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { JwtTokenService } from './infrastructure/jwt-token.service.js';
import { createAuditLogRepository } from '../audit/audit.module.js';
import type { AuditActor } from './application/audit-actor.js';
import { Login } from './application/login.usecase.js';
import { CreateAdminUser } from './application/create-admin-user.usecase.js';
import { GetCurrentAdmin } from './application/get-current-admin.usecase.js';
import { SyncPermissions } from './application/sync-permissions.usecase.js';
import { ListAdminUsers } from './application/list-admin-users.usecase.js';
import { SetAdminUserActive } from './application/set-admin-user-active.usecase.js';
import { UpdateAdminUserRoles } from './application/update-admin-user-roles.usecase.js';
import { ResetAdminUserPassword } from './application/reset-admin-user-password.usecase.js';
import { ListRoles, CreateRole, UpdateRolePermissions, DeleteRole, ListPermissions } from './application/role.usecases.js';
import { authenticate, authorize } from './interface/http/auth.middleware.js';
import {
  loginSchema,
  createAdminUserSchema,
  setAdminUserActiveSchema,
  updateAdminUserRolesSchema,
  resetAdminUserPasswordSchema,
  createRoleSchema,
  updateRolePermissionsSchema,
} from './interface/http/schemas.js';

export interface AuthModule {
  /** Unauthenticated routes (login) — mount BEFORE the authenticate middleware. */
  public: Router;
  /** Authenticated admin routes owned by this module (admin users, roles, permissions). */
  admin: Router;
  /** The middleware every other /admin/v1 route is protected by. */
  authenticate: ReturnType<typeof authenticate>;
  authorize: typeof authorize;
}

/** Composition root for Auth/RBAC. */
export function createAuthModule(db: Db): AuthModule {
  const adminUsers = new PrismaAdminUserRepository(db);
  const permissions = new PrismaPermissionRepository(db);
  const roles = new PrismaRoleRepository(db);
  const hasher = new ScryptPasswordHasher();
  const tokens = new JwtTokenService(env.JWT_SECRET);
  const auditLogs = createAuditLogRepository(db);

  // Resolved once per mutation route — every System > Users/Roles write
  // records who did it (see audit.prisma's own header comment on why
  // this pass scopes the audit trail to exactly these mutations).
  async function resolveActor(req: Request): Promise<AuditActor> {
    const user = await adminUsers.findByPublicId(req.adminUser!.adminUserPublicId);
    return { id: user?.id ?? null, email: user?.email ?? null };
  }

  const login = new Login(adminUsers, hasher, tokens);
  const createAdminUser = new CreateAdminUser(adminUsers, hasher, auditLogs);
  const getCurrentAdmin = new GetCurrentAdmin(adminUsers);
  const syncPermissions = new SyncPermissions(permissions, auditLogs);
  const listAdminUsers = new ListAdminUsers(adminUsers);
  const setAdminUserActive = new SetAdminUserActive(adminUsers, auditLogs);
  const updateAdminUserRoles = new UpdateAdminUserRoles(adminUsers, auditLogs);
  const resetAdminUserPassword = new ResetAdminUserPassword(adminUsers, hasher, auditLogs);
  const listRoles = new ListRoles(roles);
  const createRole = new CreateRole(roles, auditLogs);
  const updateRolePermissions = new UpdateRolePermissions(roles, auditLogs);
  const deleteRole = new DeleteRole(roles, auditLogs);
  const listPermissions = new ListPermissions(permissions);

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

  // --- System > Users -------------------------------------------------
  admin.get(
    '/auth/admin-users',
    authorize('admin:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listAdminUsers.execute() });
    }),
  );
  admin.post(
    '/auth/admin-users',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createAdminUserSchema, req.body);
      res.status(201).json({ data: await createAdminUser.execute(body, await resolveActor(req)) });
    }),
  );
  admin.patch(
    '/auth/admin-users/:publicId/active',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(setAdminUserActiveSchema, req.body);
      await setAdminUserActive.execute(
        {
          actorPublicId: req.adminUser!.adminUserPublicId,
          targetPublicId: req.params.publicId!,
          isActive: body.isActive,
        },
        await resolveActor(req),
      );
      res.status(204).send();
    }),
  );
  admin.put(
    '/auth/admin-users/:publicId/roles',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateAdminUserRolesSchema, req.body);
      await updateAdminUserRoles.execute({ publicId: req.params.publicId!, roleCodes: body.roleCodes ?? [] }, await resolveActor(req));
      res.status(204).send();
    }),
  );
  admin.post(
    '/auth/admin-users/:publicId/reset-password',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(resetAdminUserPasswordSchema, req.body);
      await resetAdminUserPassword.execute({ publicId: req.params.publicId!, newPassword: body.newPassword }, await resolveActor(req));
      res.status(204).send();
    }),
  );

  // --- System > Roles & Permissions ------------------------------------
  admin.get(
    '/auth/roles',
    authorize('admin:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listRoles.execute() });
    }),
  );
  admin.post(
    '/auth/roles',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createRoleSchema, req.body);
      await createRole.execute(body, await resolveActor(req));
      res.status(201).json({ data: { code: body.code } });
    }),
  );
  admin.put(
    '/auth/roles/:code/permissions',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateRolePermissionsSchema, req.body);
      await updateRolePermissions.execute({ code: req.params.code!, permissionCodes: body.permissionCodes ?? [] }, await resolveActor(req));
      res.status(204).send();
    }),
  );
  admin.delete(
    '/auth/roles/:code',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      await deleteRole.execute(req.params.code!, await resolveActor(req));
      res.status(204).send();
    }),
  );
  admin.get(
    '/auth/permissions',
    authorize('admin:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listPermissions.execute() });
    }),
  );

  admin.post(
    '/auth/sync-permissions',
    authorize('admin:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await syncPermissions.execute(await resolveActor(req)) });
    }),
  );

  return { public: publicRouter, admin, authenticate: authenticate(tokens), authorize };
}

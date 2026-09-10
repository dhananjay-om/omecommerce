import type { RoleRepository, RoleListItem, PermissionRepository, PermissionSummary } from '../domain/repositories.js';
import type { AuditLogRepository } from '../../audit/domain/repositories.js';
import type { AuditActor } from './audit-actor.js';
import { SUPER_ADMIN_ROLE_CODE } from '../domain/permission-catalog.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/domain/errors.js';

export type RoleView = RoleListItem;

/** System > Roles & Permissions. */
export class ListRoles {
  constructor(private readonly roles: RoleRepository) {}

  async execute(): Promise<RoleView[]> {
    return this.roles.list();
  }
}

export interface CreateRoleCommand {
  code: string;
  name: string;
}

export class CreateRole {
  constructor(
    private readonly roles: RoleRepository,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(cmd: CreateRoleCommand, actor?: AuditActor): Promise<void> {
    if (await this.roles.findByCode(cmd.code)) {
      throw new ConflictError(`role already exists: ${cmd.code}`);
    }
    await this.roles.create(cmd.code, cmd.name);
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: cmd.code,
      summary: `Created role "${cmd.name}" (${cmd.code})`,
    });
  }
}

export interface UpdateRolePermissionsCommand {
  code: string;
  permissionCodes: string[];
}

export class UpdateRolePermissions {
  constructor(
    private readonly roles: RoleRepository,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(cmd: UpdateRolePermissionsCommand, actor?: AuditActor): Promise<void> {
    const role = await this.roles.findByCode(cmd.code);
    if (!role) throw new NotFoundError('role', cmd.code);
    await this.roles.updatePermissions(cmd.code, cmd.permissionCodes);
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'ROLE_PERMISSIONS_UPDATED',
      entityType: 'Role',
      entityId: cmd.code,
      summary: `Set permissions for "${role.name}" — now ${cmd.permissionCodes.length} granted`,
      metadata: { permissionCodes: cmd.permissionCodes },
    });
  }
}

/** Guarded: the super-admin role can never be deleted (every permission
 *  sync targets it by code — deleting it would break Sync Permissions
 *  outright), and any role still assigned to at least one admin user is
 *  blocked too, rather than silently stripping it from them via the
 *  schema's own CASCADE. */
export class DeleteRole {
  constructor(
    private readonly roles: RoleRepository,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(code: string, actor?: AuditActor): Promise<void> {
    const role = await this.roles.findByCode(code);
    if (!role) throw new NotFoundError('role', code);
    if (code === SUPER_ADMIN_ROLE_CODE) {
      throw new ValidationError('The Super Admin role cannot be deleted.');
    }
    if (role.userCount > 0) {
      throw new ConflictError(`Cannot delete "${role.name}" — it is still assigned to ${role.userCount} admin user(s). Reassign them first.`);
    }
    await this.roles.delete(code);
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'ROLE_DELETED',
      entityType: 'Role',
      entityId: code,
      summary: `Deleted role "${role.name}" (${code})`,
    });
  }
}

export class ListPermissions {
  constructor(private readonly permissions: PermissionRepository) {}

  async execute(): Promise<PermissionSummary[]> {
    return this.permissions.listAll();
  }
}

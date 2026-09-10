import type { AdminUserRepository } from '../domain/repositories.js';
import type { AuditLogRepository } from '../../audit/domain/repositories.js';
import type { AuditActor } from './audit-actor.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export interface UpdateAdminUserRolesCommand {
  publicId: string;
  roleCodes: string[];
}

export class UpdateAdminUserRoles {
  constructor(
    private readonly adminUsers: AdminUserRepository,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(cmd: UpdateAdminUserRolesCommand, actor?: AuditActor): Promise<void> {
    const user = await this.adminUsers.findByPublicId(cmd.publicId);
    if (!user) throw new NotFoundError('admin user', cmd.publicId);
    await this.adminUsers.updateRoles(cmd.publicId, cmd.roleCodes);
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'ADMIN_USER_ROLES_UPDATED',
      entityType: 'AdminUser',
      entityId: cmd.publicId,
      summary: `Set roles for ${user.email} to [${cmd.roleCodes.join(', ') || 'none'}]`,
      metadata: { roleCodes: cmd.roleCodes },
    });
  }
}

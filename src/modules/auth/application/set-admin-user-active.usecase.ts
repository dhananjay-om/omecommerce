import type { AdminUserRepository } from '../domain/repositories.js';
import type { AuditLogRepository } from '../../audit/domain/repositories.js';
import type { AuditActor } from './audit-actor.js';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors.js';

export interface SetAdminUserActiveCommand {
  actorPublicId: string;
  targetPublicId: string;
  isActive: boolean;
}

/** Deactivate/reactivate an admin user. Guarded: an admin can never
 *  deactivate their own account (there'd be no other authenticated
 *  request left to undo it with, short of a direct DB edit). */
export class SetAdminUserActive {
  constructor(
    private readonly adminUsers: AdminUserRepository,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(cmd: SetAdminUserActiveCommand, actor?: AuditActor): Promise<void> {
    if (!cmd.isActive && cmd.actorPublicId === cmd.targetPublicId) {
      throw new ValidationError('You cannot deactivate your own account.');
    }
    const user = await this.adminUsers.findByPublicId(cmd.targetPublicId);
    if (!user) throw new NotFoundError('admin user', cmd.targetPublicId);
    await this.adminUsers.setActive(cmd.targetPublicId, cmd.isActive);
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: cmd.isActive ? 'ADMIN_USER_REACTIVATED' : 'ADMIN_USER_DEACTIVATED',
      entityType: 'AdminUser',
      entityId: cmd.targetPublicId,
      summary: `${cmd.isActive ? 'Reactivated' : 'Deactivated'} admin user ${user.email}`,
    });
  }
}

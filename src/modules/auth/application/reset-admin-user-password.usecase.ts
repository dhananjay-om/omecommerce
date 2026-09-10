import type { AdminUserRepository } from '../domain/repositories.js';
import type { PasswordHasher } from '../domain/ports.js';
import type { AuditLogRepository } from '../../audit/domain/repositories.js';
import type { AuditActor } from './audit-actor.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export interface ResetAdminUserPasswordCommand {
  publicId: string;
  newPassword: string;
}

/** An admin (holding admin:manage) sets a new password directly — there's
 *  no self-service forgot-password flow for admin accounts yet, so this
 *  is the only remediation path when someone is locked out. Mirrors
 *  CreateAdminUser's own hash-then-store shape. */
export class ResetAdminUserPassword {
  constructor(
    private readonly adminUsers: AdminUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(cmd: ResetAdminUserPasswordCommand, actor?: AuditActor): Promise<void> {
    const user = await this.adminUsers.findByPublicId(cmd.publicId);
    if (!user) throw new NotFoundError('admin user', cmd.publicId);
    const passwordHash = await this.hasher.hash(cmd.newPassword);
    await this.adminUsers.resetPassword(cmd.publicId, passwordHash);
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'ADMIN_USER_PASSWORD_RESET',
      entityType: 'AdminUser',
      entityId: cmd.publicId,
      summary: `Reset password for ${user.email}`,
    });
  }
}

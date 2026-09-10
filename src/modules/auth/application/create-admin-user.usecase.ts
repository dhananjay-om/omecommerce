import type { AdminUserRepository } from '../domain/repositories.js';
import type { PasswordHasher } from '../domain/ports.js';
import type { AuditLogRepository } from '../../audit/domain/repositories.js';
import type { AuditActor } from './audit-actor.js';
import { ConflictError } from '../../../shared/domain/errors.js';

export interface CreateAdminUserCommand {
  email: string;
  password: string;
  roleCodes?: string[];
}

export class CreateAdminUser {
  constructor(
    private readonly adminUsers: AdminUserRepository,
    private readonly hasher: PasswordHasher,
    private readonly auditLogs?: AuditLogRepository,
  ) {}

  async execute(cmd: CreateAdminUserCommand, actor?: AuditActor): Promise<{ publicId: string; email: string }> {
    if (await this.adminUsers.findByEmail(cmd.email)) {
      throw new ConflictError(`admin user already exists: ${cmd.email}`);
    }
    const passwordHash = await this.hasher.hash(cmd.password);
    const result = await this.adminUsers.create({ email: cmd.email, passwordHash, roleCodes: cmd.roleCodes ?? [] });
    await this.auditLogs?.record({
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: 'ADMIN_USER_CREATED',
      entityType: 'AdminUser',
      entityId: result.publicId,
      summary: `Created admin user ${result.email}`,
      metadata: { roleCodes: cmd.roleCodes ?? [] },
    });
    return result;
  }
}

import type { AdminUserRepository } from '../domain/repositories.js';
import type { PasswordHasher } from '../domain/ports.js';
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
  ) {}

  async execute(cmd: CreateAdminUserCommand): Promise<{ publicId: string; email: string }> {
    if (await this.adminUsers.findByEmail(cmd.email)) {
      throw new ConflictError(`admin user already exists: ${cmd.email}`);
    }
    const passwordHash = await this.hasher.hash(cmd.password);
    return this.adminUsers.create({ email: cmd.email, passwordHash, roleCodes: cmd.roleCodes ?? [] });
  }
}

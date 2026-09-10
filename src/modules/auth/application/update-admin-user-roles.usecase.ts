import type { AdminUserRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export interface UpdateAdminUserRolesCommand {
  publicId: string;
  roleCodes: string[];
}

export class UpdateAdminUserRoles {
  constructor(private readonly adminUsers: AdminUserRepository) {}

  async execute(cmd: UpdateAdminUserRolesCommand): Promise<void> {
    const user = await this.adminUsers.findByPublicId(cmd.publicId);
    if (!user) throw new NotFoundError('admin user', cmd.publicId);
    await this.adminUsers.updateRoles(cmd.publicId, cmd.roleCodes);
  }
}

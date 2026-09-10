import type { AdminUserRepository } from '../domain/repositories.js';
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
  constructor(private readonly adminUsers: AdminUserRepository) {}

  async execute(cmd: SetAdminUserActiveCommand): Promise<void> {
    if (!cmd.isActive && cmd.actorPublicId === cmd.targetPublicId) {
      throw new ValidationError('You cannot deactivate your own account.');
    }
    const user = await this.adminUsers.findByPublicId(cmd.targetPublicId);
    if (!user) throw new NotFoundError('admin user', cmd.targetPublicId);
    await this.adminUsers.setActive(cmd.targetPublicId, cmd.isActive);
  }
}

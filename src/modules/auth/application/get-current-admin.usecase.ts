import type { AdminUserRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export interface CurrentAdminView {
  email: string;
  permissions: string[];
}

/** Resolves the currently authenticated admin's own identity — permissions
 *  come straight from the JWT (already verified by `authenticate`), the
 *  email is the one DB lookup this needs. Powers apps/admin's nav/UI
 *  permission gating (dashboard-nav.tsx, top-header.tsx). */
export class GetCurrentAdmin {
  constructor(private readonly adminUsers: AdminUserRepository) {}

  async execute(adminUserPublicId: string, permissions: string[]): Promise<CurrentAdminView> {
    const user = await this.adminUsers.findByPublicId(adminUserPublicId);
    if (!user) throw new NotFoundError('admin user', adminUserPublicId);
    return { email: user.email, permissions };
  }
}

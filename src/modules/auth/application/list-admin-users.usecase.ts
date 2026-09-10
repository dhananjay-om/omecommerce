import type { AdminUserRepository, AdminUserListItem } from '../domain/repositories.js';

export interface AdminUserView {
  publicId: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ code: string; name: string }>;
}

function toView(item: AdminUserListItem): AdminUserView {
  return {
    publicId: item.publicId,
    email: item.email,
    isActive: item.isActive,
    lastLoginAt: item.lastLoginAt ? item.lastLoginAt.toISOString() : null,
    createdAt: item.createdAt.toISOString(),
    roles: item.roles,
  };
}

/** System > Users. */
export class ListAdminUsers {
  constructor(private readonly adminUsers: AdminUserRepository) {}

  async execute(): Promise<AdminUserView[]> {
    const rows = await this.adminUsers.list();
    return rows.map(toView);
  }
}

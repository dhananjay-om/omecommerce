import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { RoleRepository, RoleListItem } from '../domain/repositories.js';

const ROLE_SELECT = {
  code: true,
  name: true,
  permissions: { select: { permission: { select: { code: true } } } },
  users: { select: { adminUserId: true } },
} as const;

function toListItem(row: { code: string; name: string; permissions: { permission: { code: string } }[]; users: { adminUserId: bigint }[] }): RoleListItem {
  return {
    code: row.code,
    name: row.name,
    permissionCodes: row.permissions.map((p) => p.permission.code),
    userCount: row.users.length,
  };
}

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<RoleListItem[]> {
    const rows = await this.db.role.findMany({ select: ROLE_SELECT, orderBy: { name: 'asc' } });
    return rows.map(toListItem);
  }

  async findByCode(code: string): Promise<RoleListItem | null> {
    const row = await this.db.role.findFirst({ where: { code }, select: ROLE_SELECT });
    return row ? toListItem(row) : null;
  }

  async create(code: string, name: string): Promise<void> {
    await this.db.role.create({ data: { code, name } });
  }

  async updatePermissions(code: string, permissionCodes: string[]): Promise<void> {
    const role = await this.db.role.findFirst({ where: { code }, select: { id: true } });
    if (!role) return;
    await this.db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissionCodes.length > 0) {
        const permissions = await tx.permission.findMany({ where: { code: { in: permissionCodes } }, select: { id: true } });
        await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
      }
    });
  }

  async delete(code: string): Promise<void> {
    await this.db.role.delete({ where: { code } });
  }
}

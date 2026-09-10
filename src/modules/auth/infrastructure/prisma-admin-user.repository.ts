import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AdminUserRepository, AdminUserRecord, AdminUserListItem, CreateAdminUserInput } from '../domain/repositories.js';

export class PrismaAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    return this.db.adminUser.findFirst({
      where: { email },
      select: { id: true, publicId: true, email: true, passwordHash: true, isActive: true },
    });
  }

  async findByPublicId(publicId: string): Promise<AdminUserRecord | null> {
    return this.db.adminUser.findFirst({
      where: { publicId },
      select: { id: true, publicId: true, email: true, passwordHash: true, isActive: true },
    });
  }

  async create(input: CreateAdminUserInput): Promise<{ publicId: string; email: string }> {
    return this.db.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: { email: input.email, passwordHash: input.passwordHash },
      });
      if (input.roleCodes.length > 0) {
        const roles = await tx.role.findMany({ where: { code: { in: input.roleCodes } }, select: { id: true } });
        await tx.adminUserRole.createMany({
          data: roles.map((r) => ({ adminUserId: user.id, roleId: r.id })),
        });
      }
      return { publicId: user.publicId, email: user.email };
    });
  }

  async findPermissions(adminUserId: bigint): Promise<string[]> {
    const rows = await this.db.rolePermission.findMany({
      where: { role: { users: { some: { adminUserId } } } },
      select: { permission: { select: { code: true } } },
    });
    return [...new Set(rows.map((r) => r.permission.code))];
  }

  async list(): Promise<AdminUserListItem[]> {
    const rows = await this.db.adminUser.findMany({
      where: { deletedAt: null },
      select: {
        publicId: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      publicId: r.publicId,
      email: r.email,
      isActive: r.isActive,
      lastLoginAt: r.lastLoginAt,
      createdAt: r.createdAt,
      roles: r.roles.map((ar) => ar.role),
    }));
  }

  async setActive(publicId: string, isActive: boolean): Promise<void> {
    await this.db.adminUser.update({ where: { publicId }, data: { isActive } });
  }

  async updateRoles(publicId: string, roleCodes: string[]): Promise<void> {
    const user = await this.db.adminUser.findFirst({ where: { publicId }, select: { id: true } });
    if (!user) return;
    await this.db.$transaction(async (tx) => {
      await tx.adminUserRole.deleteMany({ where: { adminUserId: user.id } });
      if (roleCodes.length > 0) {
        const roles = await tx.role.findMany({ where: { code: { in: roleCodes } }, select: { id: true } });
        await tx.adminUserRole.createMany({ data: roles.map((r) => ({ adminUserId: user.id, roleId: r.id })) });
      }
    });
  }

  async resetPassword(publicId: string, passwordHash: string): Promise<void> {
    await this.db.adminUser.update({ where: { publicId }, data: { passwordHash } });
  }

  async recordLogin(id: bigint): Promise<void> {
    await this.db.adminUser.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
}

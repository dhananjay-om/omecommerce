import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { AdminUserRepository, AdminUserRecord, CreateAdminUserInput } from '../domain/repositories.js';

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
}

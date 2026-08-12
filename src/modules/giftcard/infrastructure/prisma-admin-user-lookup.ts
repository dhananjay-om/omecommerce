import type { Db } from '../../../shared/infrastructure/prisma/client.js';

/** Read-only cross-module lookup: own trivial copy (not wallet module's identical PrismaAdminUserLookup — genuinely trivial, not correctness-critical). */
export class PrismaAdminUserLookup {
  constructor(private readonly db: Db) {}

  async findIdByPublicId(adminUserPublicId: string): Promise<bigint | null> {
    const row = await this.db.adminUser.findFirst({ where: { publicId: adminUserPublicId }, select: { id: true } });
    return row?.id ?? null;
  }
}

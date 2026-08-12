import type { Db } from '../../../shared/infrastructure/prisma/client.js';

/**
 * Read-only cross-module lookup: resolves an admin's publicId (all the JWT
 * carries) to their internal id, so money-moving admin actions can record a
 * real actorId — plan/10 §2 explicitly calls out actor_id/reason auditing for
 * stored-value corrections, unlike Inventory's still-unwired actorId today.
 */
export class PrismaAdminUserLookup {
  constructor(private readonly db: Db) {}

  async findIdByPublicId(adminUserPublicId: string): Promise<bigint | null> {
    const row = await this.db.adminUser.findFirst({ where: { publicId: adminUserPublicId }, select: { id: true } });
    return row?.id ?? null;
  }
}

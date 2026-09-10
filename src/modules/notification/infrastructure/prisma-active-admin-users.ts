import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ActiveAdminUsersLookup } from '../domain/repositories.js';

export class PrismaActiveAdminUsersLookup implements ActiveAdminUsersLookup {
  constructor(private readonly db: Db) {}

  async listIds(): Promise<bigint[]> {
    const rows = await this.db.adminUser.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}

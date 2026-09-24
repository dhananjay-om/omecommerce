import type { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { TopBarRepository, TopBarRecord, TopBarLink } from '../domain/repositories.js';

export class PrismaTopBarRepository implements TopBarRepository {
  constructor(private readonly db: Db) {}

  async findByWebsiteCode(websiteCode: string): Promise<{ websiteId: bigint; record: TopBarRecord | null } | null> {
    const website = await this.db.website.findFirst({ where: { code: websiteCode }, select: { id: true } });
    if (!website) return null;
    const row = await this.db.topBarSetting.findUnique({ where: { websiteId: website.id } });
    if (!row) return { websiteId: website.id, record: null };
    return {
      websiteId: website.id,
      record: {
        isEnabled: row.isEnabled,
        showStoreSwitcher: row.showStoreSwitcher,
        phone: row.phone,
        message: row.message,
        links: row.links as unknown as TopBarLink[],
      },
    };
  }

  async upsert(websiteId: bigint, record: TopBarRecord, updatedBy: bigint | null): Promise<void> {
    const data = {
      isEnabled: record.isEnabled,
      showStoreSwitcher: record.showStoreSwitcher,
      phone: record.phone,
      message: record.message,
      links: record.links as unknown as Prisma.InputJsonValue,
      updatedBy,
    };
    await this.db.topBarSetting.upsert({ where: { websiteId }, create: { websiteId, ...data }, update: data });
  }

  async reset(websiteId: bigint): Promise<void> {
    await this.db.topBarSetting.deleteMany({ where: { websiteId } });
  }
}

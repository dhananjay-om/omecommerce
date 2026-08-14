import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WebsiteRepository, WebsiteInfo } from '../domain/repositories.js';

export class PrismaWebsiteRepository implements WebsiteRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<WebsiteInfo[]> {
    const rows = await this.db.website.findMany({
      orderBy: { code: 'asc' },
      select: { publicId: true, code: true, name: true, gstin: true, originStateCode: true, pricesIncludeTax: true },
    });
    return rows;
  }

  async update(
    code: string,
    input: { gstin?: string | null; originStateCode?: string | null; pricesIncludeTax?: boolean },
  ): Promise<WebsiteInfo> {
    const row = await this.db.website.update({
      where: { code },
      data: { gstin: input.gstin, originStateCode: input.originStateCode, pricesIncludeTax: input.pricesIncludeTax },
      select: { publicId: true, code: true, name: true, gstin: true, originStateCode: true, pricesIncludeTax: true },
    });
    return row;
  }
}

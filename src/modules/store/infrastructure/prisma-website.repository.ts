import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WebsiteRepository, WebsiteInfo } from '../domain/repositories.js';

const SELECT = {
  publicId: true,
  code: true,
  name: true,
  gstin: true,
  originStateCode: true,
  pricesIncludeTax: true,
  address: true,
  logoMediaKey: true,
} as const;

export class PrismaWebsiteRepository implements WebsiteRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<WebsiteInfo[]> {
    const rows = await this.db.website.findMany({ orderBy: { code: 'asc' }, select: SELECT });
    return rows;
  }

  async update(
    code: string,
    input: {
      gstin?: string | null;
      originStateCode?: string | null;
      pricesIncludeTax?: boolean;
      address?: string | null;
      logoMediaKey?: string | null;
    },
  ): Promise<WebsiteInfo> {
    const row = await this.db.website.update({
      where: { code },
      data: {
        gstin: input.gstin,
        originStateCode: input.originStateCode,
        pricesIncludeTax: input.pricesIncludeTax,
        address: input.address,
        logoMediaKey: input.logoMediaKey,
      },
      select: SELECT,
    });
    return row;
  }
}

import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WebsiteRepository, WebsiteInfo } from '../domain/repositories.js';
import { toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';

const SELECT = {
  publicId: true,
  code: true,
  name: true,
  gstin: true,
  originStateCode: true,
  pricesIncludeTax: true,
  address: true,
  logoMediaKey: true,
  supportEmail: true,
  walletEnabled: true,
  walletMaxPercentOfOrder: true,
  walletMinOrderValue: true,
  walletMaxAmountPerOrder: true,
} as const;

/** Prisma's Decimal.toString() strips trailing zeros ("50.00" -> "50") — harmless for
 *  walletMaxPercentOfOrder (only ever fed through Number()), but round-tripped through
 *  toMinorUnits/fromMinorUnits here anyway so every WebsiteInfo consumer sees a canonical
 *  4-decimal string, same discipline as company/infrastructure's formatDecimal(). */
function formatDecimal(value: { toString(): string } | null): string | null {
  return value === null ? null : fromMinorUnits(toMinorUnits(value.toString()));
}

function toWebsiteInfo(row: {
  publicId: string;
  code: string;
  name: string;
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  address: string | null;
  logoMediaKey: string | null;
  supportEmail: string | null;
  walletEnabled: boolean;
  walletMaxPercentOfOrder: { toString(): string } | null;
  walletMinOrderValue: { toString(): string } | null;
  walletMaxAmountPerOrder: { toString(): string } | null;
}): WebsiteInfo {
  return {
    ...row,
    // NOT formatDecimal() — that's a scale-4 money round-trip, and this is a
    // scale-2 percentage; plain toString() is exact and correct here (its
    // only consumer, wallet-rules.ts's walletCapMinor(), reads it via
    // Number(), which parses "50" and "50.00" identically either way).
    walletMaxPercentOfOrder: row.walletMaxPercentOfOrder?.toString() ?? null,
    walletMinOrderValue: formatDecimal(row.walletMinOrderValue),
    walletMaxAmountPerOrder: formatDecimal(row.walletMaxAmountPerOrder),
  };
}

export class PrismaWebsiteRepository implements WebsiteRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<WebsiteInfo[]> {
    const rows = await this.db.website.findMany({ orderBy: { code: 'asc' }, select: SELECT });
    return rows.map(toWebsiteInfo);
  }

  async update(
    code: string,
    input: {
      gstin?: string | null;
      originStateCode?: string | null;
      pricesIncludeTax?: boolean;
      address?: string | null;
      logoMediaKey?: string | null;
      supportEmail?: string | null;
      walletEnabled?: boolean;
      walletMaxPercentOfOrder?: string | null;
      walletMinOrderValue?: string | null;
      walletMaxAmountPerOrder?: string | null;
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
        supportEmail: input.supportEmail,
        walletEnabled: input.walletEnabled,
        walletMaxPercentOfOrder: input.walletMaxPercentOfOrder,
        walletMinOrderValue: input.walletMinOrderValue,
        walletMaxAmountPerOrder: input.walletMaxAmountPerOrder,
      },
      select: SELECT,
    });
    return toWebsiteInfo(row);
  }
}

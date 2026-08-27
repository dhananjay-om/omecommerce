import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { WebsiteRepository, WebsiteInfo, PublicStoreInfo } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import { toMinorUnits, fromMinorUnits } from '../../../shared/domain/decimal.js';

const SELECT = {
  publicId: true,
  code: true,
  name: true,
  baseCurrency: true,
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
  baseCurrency: string;
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

  async findByCode(code: string): Promise<WebsiteInfo | null> {
    const row = await this.db.website.findFirst({ where: { code }, select: SELECT });
    return row ? toWebsiteInfo(row) : null;
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

  async createStore(input: {
    websiteCode: string;
    websiteName: string;
    currency: string;
    storeCode: string;
    storeViewCode: string;
    languageId: bigint;
  }): Promise<WebsiteInfo> {
    try {
      const website = await this.db.$transaction(async (tx) => {
        // Not `select: SELECT` — this needs the real numeric `id` too, to
        // create the Store row against, which SELECT (the shared list/
        // update projection) deliberately omits.
        const w = await tx.website.create({
          data: { code: input.websiteCode, name: input.websiteName, baseCurrency: input.currency },
        });
        const store = await tx.store.create({ data: { websiteId: w.id, code: input.storeCode, name: input.websiteName } });
        await tx.storeView.create({
          data: { storeId: store.id, code: input.storeViewCode, languageId: input.languageId, currency: input.currency },
        });
        return w;
      });
      return toWebsiteInfo(website);
    } catch (err) {
      // Belt-and-suspenders alongside CreateStore's own pre-check — closes
      // the small TOCTOU window between that check and this transaction.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`website code already exists: ${input.websiteCode}`);
      }
      throw err;
    }
  }

  async listPublicStores(): Promise<PublicStoreInfo[]> {
    const rows = await this.db.storeView.findMany({
      where: { status: 'ACTIVE', deletedAt: null, store: { deletedAt: null, website: { deletedAt: null } } },
      select: {
        id: true,
        code: true,
        currency: true,
        store: { select: { website: { select: { code: true, name: true, isDefault: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((r) => ({
      websiteCode: r.store.website.code,
      websiteName: r.store.website.name,
      storeViewId: r.id,
      storeViewCode: r.code,
      currency: r.currency,
      isDefault: r.store.website.isDefault,
    }));
  }

  async listLanguageIds(): Promise<bigint[]> {
    const rows = await this.db.language.findMany({ select: { id: true } });
    return rows.map((r) => r.id);
  }
}

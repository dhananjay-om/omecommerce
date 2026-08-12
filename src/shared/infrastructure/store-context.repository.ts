import type { Db } from './prisma/client.js';
import type { StoreContextResolver, StoreViewContext } from '../application/scope.js';

/**
 * Resolves a store view into its full scope chain (store view -> store -> website)
 * plus presentation context (currency/language). Cached later (plan/09 §3); for now a
 * single indexed join. Reused by every scoped read.
 */
export class PrismaStoreContextResolver implements StoreContextResolver {
  constructor(private readonly db: Db) {}

  async byStoreViewId(storeViewId: bigint): Promise<StoreViewContext | null> {
    const sv = await this.db.storeView.findFirst({
      where: { id: storeViewId },
      select: {
        id: true,
        code: true,
        currency: true,
        languageId: true,
        isRtl: true,
        storeId: true,
        store: { select: { websiteId: true } },
      },
    });
    if (!sv) return null;
    return {
      storeViewId: sv.id,
      storeId: sv.storeId,
      websiteId: sv.store.websiteId,
      storeViewCode: sv.code,
      currency: sv.currency,
      languageId: sv.languageId,
      isRtl: sv.isRtl,
    };
  }
}

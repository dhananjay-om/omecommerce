/**
 * Scope resolution primitives (plan/00-master-plan.md §2, plan/01 §1).
 * Resolution order (most specific wins): STORE_VIEW -> STORE -> WEBSITE -> GLOBAL.
 * Every scoped read across the platform (attributes, pricing, config, CMS, SEO) uses
 * this same chain, so it lives in shared/application.
 */

/** The full ancestor chain a store view belongs to. */
export interface ScopeChain {
  storeViewId: bigint;
  storeId: bigint;
  websiteId: bigint;
}

/** A resolved store-view context threaded through a request (plan/05 §1). */
export interface StoreViewContext extends ScopeChain {
  storeViewCode: string;
  currency: string;
  languageId: bigint;
  isRtl: boolean;
}

/** Numeric rank matching the DB `scope_rank` generated column. Higher wins. */
export const SCOPE_RANK = {
  GLOBAL: 0,
  WEBSITE: 1,
  STORE: 2,
  STORE_VIEW: 3,
} as const;

/** Port: resolve a store-view public id (or internal id) into its full context. */
export interface StoreContextResolver {
  byStoreViewId(storeViewId: bigint): Promise<StoreViewContext | null>;
}

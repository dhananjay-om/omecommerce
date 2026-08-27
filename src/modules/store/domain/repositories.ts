export interface CurrencyInfo {
  code: string;
  symbol: string;
  minorUnits: number;
  name: string;
  isDefault: boolean;
}

export interface CreateCurrencyInput {
  code: string;
  symbol: string;
  name: string;
  minorUnits?: number;
}

export interface UpdateCurrencyInput {
  symbol?: string;
  name?: string;
  minorUnits?: number;
  /** true: sets this one as default, unsetting whichever currency was default before, in the
   *  same transaction (the uq_one_default_currency partial unique index is the real guarantee —
   *  this is defense in depth, same reasoning as customer_address's is_default_shipping/billing).
   *  false: just unsets this one, leaving no default at all. undefined: flag untouched. */
  isDefault?: boolean;
}

/** Currency Setup (admin-facing) — the registry price_list.currency and store_view.currency
 *  raw-SQL FKs both point at (prisma/sql/0003_pricing_raw.sql). Previously seed-only (just USD),
 *  which meant any other currency 500'd on first use instead of failing cleanly — this repository
 *  is what actually lets an admin register one, same shape as WarehouseRepository/PriceListRepository. */
export interface CurrencyRepository {
  create(input: CreateCurrencyInput): Promise<CurrencyInfo>;
  findByCode(code: string): Promise<CurrencyInfo | null>;
  list(): Promise<CurrencyInfo[]>;
  update(code: string, input: UpdateCurrencyInput): Promise<CurrencyInfo>;
  /** Hard delete — Currency has no soft-delete. Deliberately no pre-check against every
   *  referencing table (price_list, cart, order, shipping_method, payment_transaction, wallet,
   *  wallet_transaction, gift_card, gift_card_transaction, website.baseCurrency,
   *  store_view.currency — all ON DELETE RESTRICT): that's ~11 tables to duplicate and keep in
   *  sync by hand. Instead this catches the DB's own FK violation and translates it to a clean
   *  ConflictError — the database is already the single source of truth for "is this in use". */
  delete(code: string): Promise<void>;
}

export interface WebsiteInfo {
  publicId: string;
  code: string;
  name: string;
  baseCurrency: string;
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  /** Freeform, print-only mailing address for the invoice letterhead — see store.prisma's doc comment. */
  address: string | null;
  /** S3 object key for the invoice-letterhead logo — see store.prisma's doc comment. Use
   *  WebsiteRepository.presignLogoUrl to turn this into something displayable. */
  logoMediaKey: string | null;
  /** Store contact email — see store.prisma's doc comment. */
  supportEmail: string | null;
  /** Store-wide wallet-tender kill switch — see store.prisma's doc comment. */
  walletEnabled: boolean;
  /** Percent (0-100) cap on how much of an order the wallet tender may cover — null means no cap. */
  walletMaxPercentOfOrder: string | null;
  /** Minimum order total (this website's base currency) required to offer the wallet tender — null means no minimum. */
  walletMinOrderValue: string | null;
  /** Absolute per-order wallet cap (this website's base currency) — null means no cap. */
  walletMaxAmountPerOrder: string | null;
}

/** Website/Store View management was a deliberate later addition (see
 *  store.module.ts) — originally scoped to exactly three admin-facing
 *  settings groups: GST registration (gstin/originStateCode/pricesIncludeTax),
 *  general store branding (address/logoMediaKey/supportEmail), and
 *  wallet-tender rules (walletEnabled/walletMaxPercentOfOrder/
 *  walletMinOrderValue/walletMaxAmountPerOrder, plan/17) — deliberately
 *  split into three update() call shapes even though all three write the
 *  same Website row, mirroring the separate admin pages/endpoints (General
 *  Settings vs GST Settings vs Wallet Settings) rather than one grab-bag
 *  update that also happened to carry unrelated fields. `createStore` (multi-
 *  store feature) is the one addition to real CRUD: baseCurrency is
 *  create-time-only, deliberately with no matching update path — a cart's
 *  currency is snapshotted once at creation and never re-derived, so a
 *  casual "edit currency" button on an existing store would silently
 *  reintroduce the exact stale-currency bug this session already had to
 *  fix by hand. Still no DELETE — too many raw-SQL-FK'd tables reference
 *  websiteId/storeId/storeViewId to safely guard/cascade in one pass. */
export interface WebsiteRepository {
  list(): Promise<WebsiteInfo[]>;
  /** Storefront's public branding read (name/logo) — the storefront addresses a
   *  website by its code (WEBSITE_CODE env), same convention as the storefront's
   *  own login/register calls' websiteCode field. */
  findByCode(code: string): Promise<WebsiteInfo | null>;
  update(
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
  ): Promise<WebsiteInfo>;
  /** One combined write creating Website + Store + Store View together —
   *  the admin thinks in terms of "a store," not this schema's 3-tier
   *  hierarchy, and the existing us_retail setup is exactly 1-of-each
   *  already. `storeCode`/`storeViewCode` are internal identifiers, not
   *  shown as separate form fields — see CreateStore's own doc comment. */
  createStore(input: {
    websiteCode: string;
    websiteName: string;
    currency: string;
    storeCode: string;
    storeViewCode: string;
    languageId: bigint;
  }): Promise<WebsiteInfo>;
  /** Every non-deleted, ACTIVE store view, joined up through Store->Website —
   *  backs the storefront's public store switcher (GET /store/v1/websites).
   *  Deliberately a separate read shape from WebsiteInfo (which has no
   *  concept of "which store view" at all) rather than overloading list(). */
  listPublicStores(): Promise<PublicStoreInfo[]>;
  /** Just enough to resolve CreateStore's languageId default — Language has
   *  no other CRUD anywhere in this codebase, doesn't warrant its own
   *  repository for one read. */
  listLanguageIds(): Promise<bigint[]>;
}

export interface PublicStoreInfo {
  websiteCode: string;
  websiteName: string;
  storeViewId: bigint;
  storeViewCode: string;
  currency: string;
  isDefault: boolean;
}

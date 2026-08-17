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
  gstin: string | null;
  originStateCode: string | null;
  pricesIncludeTax: boolean;
  /** Freeform, print-only mailing address for the invoice letterhead — see store.prisma's doc comment. */
  address: string | null;
  /** S3 object key for the invoice-letterhead logo — see store.prisma's doc comment. Use
   *  WebsiteRepository.presignLogoUrl to turn this into something displayable. */
  logoMediaKey: string | null;
}

/** Website/Store View management is still a deliberate later addition (see
 *  store.module.ts) — this is scoped to exactly the GST registration fields
 *  (list to pick which website, update to set its gstin/originStateCode) plus
 *  invoice-letterhead branding (address/logo), not full Website CRUD. */
export interface WebsiteRepository {
  list(): Promise<WebsiteInfo[]>;
  update(
    code: string,
    input: {
      gstin?: string | null;
      originStateCode?: string | null;
      pricesIncludeTax?: boolean;
      address?: string | null;
      logoMediaKey?: string | null;
    },
  ): Promise<WebsiteInfo>;
}

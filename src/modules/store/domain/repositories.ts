export interface CurrencyInfo {
  code: string;
  symbol: string;
  minorUnits: number;
  name: string;
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
}

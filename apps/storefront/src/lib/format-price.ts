/**
 * ISO-4217 code -> symbol, for display only (e.g. "₹999.00" instead of
 * "INR 999.00" — standard e-commerce convention, nobody writes "USD 19.99").
 * Independent of Currency Setup's admin-configurable `symbol` field: the
 * store-facing price responses (PDP, cart, checkout, orders) only ever
 * return the plain currency code, not the registered symbol, so this is a
 * static fallback table covering common real-world currencies rather than a
 * live lookup. An unmapped code falls back to showing the code itself.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  CHF: 'CHF',
  AED: 'AED',
  SAR: 'SAR',
  ZAR: 'R',
  BRL: 'R$',
  MXN: 'MX$',
  KRW: '₩',
  RUB: '₽',
  TRY: '₺',
};

/** Formats an amount for display in the given currency — e.g. formatPrice(999, 'INR') -> "₹999.00".
 *  Never use this for schema.org/JSON-LD `priceCurrency` or any machine-read field — those need
 *  the raw ISO code, not the symbol. */
export function formatPrice(amount: number | string, currency: string): string {
  const value = Number(amount).toFixed(2);
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()];
  return symbol ? `${symbol}${value}` : `${currency} ${value}`;
}

/**
 * Locale-aware currency formatting via Intl.NumberFormat — gets the correct
 * symbol (₹, $, €, ...), correct digit grouping, and the correct number of
 * decimal places (2 for most currencies, 0 for JPY/KRW, etc.) all from one
 * built-in, for any real ISO-4217 code, no static symbol table to maintain.
 * INR specifically uses 'en-IN' so amounts group by the Indian lakh/crore
 * convention (₹1,50,000.00) rather than the international ₹150,000.00 —
 * everything else uses 'en-US' grouping (thousands every 3 digits). Own copy
 * of the storefront's identical helper — this project's established
 * convention is each app keeps its own copy rather than a shared package.
 */
const INDIAN_GROUPING_CURRENCIES = new Set(['INR']);

export function formatPrice(amount: number | string, currency: string): string {
  const value = Number(amount);
  const code = currency.toUpperCase();
  const locale = INDIAN_GROUPING_CURRENCIES.has(code) ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
  } catch {
    // Intl throws on a code it doesn't recognize as valid ISO-4217 (e.g. a
    // typo'd or custom currency) — fall back to the old plain rendering
    // rather than crashing the page over a display detail.
    return `${code} ${value.toFixed(2)}`;
  }
}

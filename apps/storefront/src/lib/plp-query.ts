/**
 * Shared URL-state helpers for the PLP/search pages (collections/[slug],
 * products, search). Filters are single-select, Link-driven — no client JS,
 * same zero-JS-navigation philosophy as admin's list pages. This also
 * matches actual backend capability: the search API's `filter[code]=value`
 * params AND together, so multi-select (OR) within one facet isn't
 * supported yet — a real future upgrade, not attempted here.
 */
export type PlpParams = Record<string, string | undefined>;

/** Next's `searchParams` prop values can be `string | string[] | undefined` — flatten to the first value for our single-select filter model. */
export function normalizeSearchParams(raw: Record<string, string | string[] | undefined>): PlpParams {
  const result: PlpParams = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

const RESERVED_KEYS = new Set(['q', 'brand', 'minPrice', 'maxPrice', 'inStock', 'sort', 'page']);

/** Any non-reserved query param is treated as a generic attribute facet filter (code = key, value = value) — works for any admin-configured filterable attribute without hardcoding which ones exist. */
export function extractAttributeFilters(params: PlpParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || RESERVED_KEYS.has(key)) continue;
    result[key] = value;
  }
  return result;
}

/** Builds an href for `basePath` from `params` with `overrides` applied, dropping empty values. Any change other than an explicit `page` override resets pagination to page 1. */
export function buildPlpHref(basePath: string, params: PlpParams, overrides: PlpParams): string {
  const merged: PlpParams = { ...params, ...overrides };
  if (!('page' in overrides)) merged.page = undefined;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Toggle helper for single-select filter links: clicking an already-active value clears it. */
export function toggleOverride(params: PlpParams, key: string, value: string): PlpParams {
  return { [key]: params[key] === value ? undefined : value };
}

const VALID_SORTS = new Set(['relevance', 'price_asc', 'price_desc', 'name_asc']);

/** Maps page URL params (+ an optional fixed filter, e.g. category/brand scoping from the route) into a products.service#searchProducts call. */
export function toSearchServiceParams(
  params: PlpParams,
  opts: { q?: string; extraFilter?: Record<string, string>; pageSize?: number } = {},
) {
  const filter: Record<string, string> = { ...opts.extraFilter, ...extractAttributeFilters(params) };
  if (params.brand) filter.__brand = params.brand;

  return {
    q: opts.q,
    filter,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    inStock: params.inStock === 'true' ? true : undefined,
    sort: (params.sort && VALID_SORTS.has(params.sort) ? params.sort : 'relevance') as
      | 'relevance'
      | 'price_asc'
      | 'price_desc'
      | 'name_asc',
    page: params.page ? Number(params.page) : 1,
    pageSize: opts.pageSize ?? 20,
  };
}

import 'server-only';

/**
 * Single-storefront config (plan/14 Phase 1) — this app serves one website/
 * store view; see .env.local's header comment. Server-only: these aren't
 * `NEXT_PUBLIC_`-prefixed, so they'd silently resolve to the fallback
 * defaults (not a real error) if ever imported from a Client Component —
 * the `server-only` import turns that into a build-time failure instead,
 * forcing the value to be passed down as a prop from a Server Component.
 */
export const WEBSITE_CODE = process.env.WEBSITE_CODE ?? 'us_retail';
export const STORE_VIEW_ID = process.env.STORE_VIEW_ID ?? '1';
/** Absolute origin for sitemap/robots/canonical URLs and OpenGraph tags (plan/14 Phase 8) — set SITE_URL in production; defaults to the local dev port. */
export const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3001';

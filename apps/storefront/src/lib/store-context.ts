import 'server-only';
import { cookies } from 'next/headers';
import { apiGet } from './api-client';
import { WEBSITE_CODE as FALLBACK_WEBSITE_CODE, STORE_VIEW_ID as FALLBACK_STORE_VIEW_ID } from './config';

const STORE_COOKIE = 'ome_store';
// Same reasoning/lifetime as the cart cookie in session.ts — a per-viewer
// preference, not a credential.
const STORE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface PublicStore {
  websiteCode: string;
  websiteName: string;
  storeViewId: string;
  storeViewCode: string;
  currency: string;
  isDefault: boolean;
}

/** Public, unauthenticated — GET /store/v1/websites. Used both by the
 *  switcher UI and by the two getters below to resolve a cookie'd
 *  storeViewId back to its website code. */
export function getPublicStores(): Promise<PublicStore[]> {
  return apiGet<PublicStore[]>('/store/v1/websites');
}

/**
 * Replaces the old hardcoded STORE_VIEW_ID constant at every call site that
 * needs "which store view is this visitor browsing" — reads the
 * `ome_store` cookie set by the storefront's own store switcher, falling
 * back to config.ts's STORE_VIEW_ID (the correct behavior for a visitor
 * who has never touched the switcher, and for any deployment that stays
 * single-store).
 */
export async function getSelectedStoreViewId(): Promise<string> {
  const store = await cookies();
  return store.get(STORE_COOKIE)?.value ?? FALLBACK_STORE_VIEW_ID;
}

/** Replaces the old hardcoded WEBSITE_CODE constant — resolved by matching
 *  the selected storeViewId against the public store list, since only the
 *  storeViewId is what's actually cookie'd (one cookie, not two). */
export async function getSelectedWebsiteCode(): Promise<string> {
  const storeViewId = await getSelectedStoreViewId();
  try {
    const stores = await getPublicStores();
    return stores.find((s) => s.storeViewId === storeViewId)?.websiteCode ?? FALLBACK_WEBSITE_CODE;
  } catch {
    // Public stores list is unreachable — fall back rather than fail the
    // whole page (same defensive posture as ensureCart's own 404 recovery).
    return FALLBACK_WEBSITE_CODE;
  }
}

/** Server Action / Route Handler only — cookies can't be set during render. */
export async function setSelectedStoreCookie(storeViewId: string): Promise<void> {
  const store = await cookies();
  store.set(STORE_COOKIE, storeViewId, {
    httpOnly: false, // the switcher dropdown itself needs to read it client-side
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STORE_MAX_AGE_SECONDS,
  });
}

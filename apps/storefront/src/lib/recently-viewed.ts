/** Client-side only, localStorage, no backend (plan/14 Phase 4 decision — this is browsing history, not account state). */
const STORAGE_KEY = 'ome_recently_viewed';
const MAX_ENTRIES = 10;

export function recordRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;
  const existing = readIds();
  const next = [productId, ...existing.filter((id) => id !== productId)].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getRecentlyViewed(excludeId?: string): string[] {
  if (typeof window === 'undefined') return [];
  return readIds().filter((id) => id !== excludeId);
}

function readIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

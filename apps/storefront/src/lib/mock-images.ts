/**
 * ÉLUME restyle — curated stock photography, used ONLY as a presentational
 * fallback where this store genuinely has no real image of its own
 * (category photos: `Category.imageUrl` is null for every category today;
 * hero/collection banners: no Banner rows exist yet; product cards on the
 * homepage: the seeded demo products' real images are flat placeholder
 * graphics, not real photography). Every URL below is a real, verified
 * Unsplash photo (`images.unsplash.com/photo-<id>`), matching the reference
 * theme's own convention of hotlinking Unsplash CDN images. Real content —
 * a category's own uploaded photo, an admin-configured Banner, a real
 * product photo once one exists — always wins over these; nothing here
 * overrides real data, only fills a real gap.
 */

export const CATEGORY_PHOTOS: Record<string, string> = {
  electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661',
  fashion: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
  'home-kitchen': 'https://images.unsplash.com/photo-1556911073-38141963c9e0',
};
const DEFAULT_CATEGORY_PHOTO = CATEGORY_PHOTOS.electronics!;

export function categoryPhoto(slug: string, size = 500): string {
  const base = CATEGORY_PHOTOS[slug] ?? DEFAULT_CATEGORY_PHOTO;
  return `${base}?w=${size}&h=${size}&fit=crop&auto=format`;
}

export const HERO_PHOTOS = {
  electronics: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1800&h=1000&fit=crop&auto=format',
  fashion: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1800&h=1000&fit=crop&auto=format',
  homeKitchen: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1800&h=1000&fit=crop&auto=format',
};

export const COLLECTION_PHOTOS = {
  electronics: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=700&h=900&fit=crop&auto=format',
  homeKitchen: 'https://images.unsplash.com/photo-1556911073-38141963c9e0?w=700&h=900&fit=crop&auto=format',
  fashion: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=700&h=900&fit=crop&auto=format',
};

export const OFFER_BANNER_PHOTO = 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1800&h=600&fit=crop&auto=format';

/** Keyword → product photo. Matched against the product name, first match wins,
 *  falls back to a generic shopping/retail photo — covers today's seed catalog
 *  and generalizes reasonably to future product names with similar words. */
const PRODUCT_PHOTO_KEYWORDS: Array<[RegExp, string]> = [
  [/coffee/i, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085'],
  [/sneaker|shoe/i, 'https://images.unsplash.com/photo-1560769629-975ec94e6a86'],
  [/shirt|tee\b/i, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab'],
  [/jacket|coat/i, 'https://images.unsplash.com/photo-1551028719-00167b16eac5'],
  [/earbud|headphone/i, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df'],
  [/phone/i, 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9'],
  [/laptop/i, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853'],
  [/bag|tote|purse/i, 'https://images.unsplash.com/photo-1591561954557-26941169b49e'],
];
const DEFAULT_PRODUCT_PHOTO = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8';

export function mockProductPhoto(name: string, size = 600): string {
  const base = PRODUCT_PHOTO_KEYWORDS.find(([re]) => re.test(name))?.[1] ?? DEFAULT_PRODUCT_PHOTO;
  return `${base}?w=${size}&h=${size}&fit=crop&auto=format`;
}

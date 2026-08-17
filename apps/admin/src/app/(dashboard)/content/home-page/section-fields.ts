import type { SectionFieldDef } from './home-page-section-form';

/** Fixed preset list, not a free-text class name field — keeps the editor
 *  simple and avoids letting an admin type an arbitrary Tailwind class
 *  string into the page. The storefront uses these values verbatim as the
 *  `bg-gradient-to-br` pair (see apps/storefront/.../hero-banner.tsx and
 *  promo-banners.tsx), so this list must stay in sync with what those
 *  components' Tailwind classes actually support. */
export const GRADIENT_OPTIONS = [
  { value: 'from-primary to-blue-700', label: 'Blue' },
  { value: 'from-indigo-600 to-violet-700', label: 'Indigo / Violet' },
  { value: 'from-rose-600 to-orange-600', label: 'Rose / Orange' },
  { value: 'from-emerald-600 to-teal-700', label: 'Emerald / Teal' },
  { value: 'from-amber-600 to-orange-700', label: 'Amber / Orange' },
  { value: 'from-rose-500 to-pink-600', label: 'Rose / Pink' },
];

/** Fixed allowlist matching today's 4 Heroicons in why-choose-us.tsx — the
 *  storefront maps this key back to the actual icon component (icon
 *  components obviously can't be stored in the DB). */
export const ICON_OPTIONS = [
  { value: 'truck', label: 'Truck (Shipping)' },
  { value: 'shield', label: 'Shield (Security)' },
  { value: 'refresh', label: 'Refresh (Returns)' },
  { value: 'chat', label: 'Chat (Support)' },
];

export const HERO_FIELDS: SectionFieldDef[] = [
  { key: 'eyebrow', label: 'Eyebrow', type: 'text', placeholder: 'New Season' },
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Upgrade Your Everyday' },
  { key: 'subtitle', label: 'Subtitle', type: 'text', placeholder: 'Fresh electronics, apparel, and home essentials.' },
  { key: 'ctaLabel', label: 'Button Text', type: 'text', placeholder: 'Shop Now' },
  { key: 'ctaHref', label: 'Button Link', type: 'text', placeholder: '/products' },
  { key: 'gradient', label: 'Color', type: 'select', options: GRADIENT_OPTIONS },
];

export const PROMO_FIELDS: SectionFieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Electronics Sale' },
  { key: 'subtitle', label: 'Subtitle', type: 'text', placeholder: 'Up to 30% off' },
  { key: 'href', label: 'Link', type: 'text', placeholder: '/collections/electronics' },
  { key: 'gradient', label: 'Color', type: 'select', options: GRADIENT_OPTIONS },
];

export const WHY_CHOOSE_US_FIELDS: SectionFieldDef[] = [
  { key: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS },
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Free Shipping' },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'On all orders over $50' },
];

export const TESTIMONIAL_FIELDS: SectionFieldDef[] = [
  { key: 'name', label: 'Customer Name', type: 'text', placeholder: 'Amara K.' },
  { key: 'quote', label: 'Quote', type: 'textarea', placeholder: 'Fast shipping and the quality is exactly as described.' },
];

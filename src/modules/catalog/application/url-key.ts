import type { ProductRepository } from '../domain/repositories.js';
import { ConflictError, ValidationError } from '../../../shared/domain/errors.js';
import { slugify } from './slugify.js';

/**
 * The admin's "URL Key" field (Search Engine Optimization group, see
 * apps/admin/.../default-attribute-groups.ts) IS the storefront slug —
 * one field, not two. It's a plain GLOBAL-scope TEXT Attribute like any
 * other (seeded once in prisma/seed.ts's default-attributes block, code
 * 'url_key'), read/written through the exact same generic AttributeFieldsSection
 * + AssignAttributeValues(Bulk) machinery every other attribute uses — no
 * special form field, no special endpoint.
 *
 * What IS special about it (see CreateProduct and AssignAttributeValue(s)'
 * own comments for where each piece happens): Product.slug is kept as the
 * real, uniquely-indexed column actual routing reads from — an EAV text
 * value has no practical way to be efficiently/safely enforced unique
 * across products the way routing needs. So this one attribute code is
 * mirrored into Product.slug on every write: CreateProduct seeds both from
 * the auto-generated slug at creation (so the admin sees it prefilled,
 * exactly like Magento auto-fills url_key from the name), and editing this
 * field afterward (same "Save Changes" flow every other attribute uses)
 * re-slugifies + uniqueness-checks the typed value and updates Product.slug
 * to match — so the admin only ever sees and edits ONE field for this,
 * this constant is just how both usecases agree on which one it is.
 */
export const URL_KEY_ATTRIBUTE_CODE = 'url_key';

/** Same reserved-route guard CreateProduct's auto-generation already applies
 *  (see its own doc comment) — an admin manually typing "cart" into URL Key
 *  must be rejected too, not just a silently-suffixed auto-generated one:
 *  they typed a SPECIFIC value on purpose, so silently changing it to
 *  "cart-2" behind their back would be far more confusing here than at
 *  creation time. */
export const RESERVED_SLUGS = new Set([
  'products',
  'brands',
  'collections',
  'offers',
  'about',
  'contact',
  'cart',
  'checkout',
  'login',
  'register',
  'account',
  'search',
  'pages',
  'api',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
  'manifest.json',
]);

/**
 * Called by AssignAttributeValue(s) whenever url_key is among the attributes
 * being saved — normalizes the admin-typed value (same slugify() rules
 * CreateProduct's auto-generation uses, so "My Product!" and "my-product"
 * both save identically) and keeps Product.slug in sync, so the very next
 * request to the storefront's new URL actually resolves. Unlike creation
 * (which silently suffixes a collision, since nothing was explicitly chosen
 * yet), an admin typing a SPECIFIC value that's already taken is a real
 * mistake worth surfacing, not silently renaming out from under them — same
 * "URL key for specified store already exists" UX Magento itself uses.
 *
 * Returns the normalized slug, so the caller writes that same value into the
 * url_key attribute row too — both stores end up byte-identical.
 */
export async function syncProductSlugFromUrlKey(
  products: ProductRepository,
  productId: bigint,
  rawValue: string,
): Promise<string> {
  const slug = slugify(rawValue, '');
  if (!slug) {
    throw new ValidationError('invalid URL key', [
      { path: 'url_key', message: 'must contain at least one letter or number' },
    ]);
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new ConflictError(`URL key "${slug}" is reserved — please choose a different one`);
  }
  const existing = await products.findBySlug(slug);
  if (existing && existing.props.id !== productId) {
    throw new ConflictError(`URL key "${slug}" is already used by another product`);
  }
  await products.updateSlug(productId, slug);
  return slug;
}

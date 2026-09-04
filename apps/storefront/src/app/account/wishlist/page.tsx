import { ensureWishlist } from '@/lib/wishlist-server';
import { getProduct } from '@/services/products.service';
import { resolveProductImage } from '@/lib/mock-images';
import { WishlistList, type EnrichedWishlistItem } from '@/components/account/wishlist-list';

export const metadata = { title: 'Wishlist' };

export default async function AccountWishlistPage() {
  const wishlist = await ensureWishlist();

  // Enrich each item with the real image/price/stock a shopper actually
  // needs to decide whether to buy it from here, not just its name/SKU —
  // one real GET /store/v1/products/:id per item (already the exact route
  // product-card.tsx's own Quick Add calls), run in parallel. A wishlisted
  // product that's since been archived/deleted 404s and is just skipped —
  // one stale row shouldn't crash the whole page.
  const items = (
    await Promise.all(
      wishlist.items.map(async (item): Promise<EnrichedWishlistItem | null> => {
        try {
          const product = await getProduct(item.productId);
          const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
          return {
            productId: item.productId,
            sku: item.sku,
            slug: item.slug,
            name: item.name,
            imageUrl: resolveProductImage(product.sku, product.name ?? product.sku, product.media[0]?.url),
            price: product.price,
            mrp: product.mrp,
            currency: product.currency,
            inStock: product.inStock,
            variantId: variant?.publicId ?? null,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter((item) => item !== null);

  return <WishlistList initialItems={items} />;
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HeartIcon, ShareIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart-store';
import { useWishlistStore } from '@/store/wishlist-store';
import { formatPrice } from '@/lib/format-price';
import { cartErrorMessage, stockLimitMessage } from '@/lib/cart-error';
import type { ProductVariant } from '@/types/product';

export function ProductActions({
  productId,
  variant,
  inStock,
  price,
  currency,
}: {
  productId: string;
  variant: ProductVariant | undefined;
  inStock: boolean;
  /** Live-selected-variant price, for the mobile sticky bar's "Add to Bag · {price}" label. */
  price: number | null;
  currency: string;
}) {
  const router = useRouter();
  const [wantedQty, setQty] = useState(1);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const addLine = useCartStore((s) => s.addLine);
  const isWishlisted = useWishlistStore((s) => s.has(productId));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  const canPurchase = inStock && !!variant;
  // Units on hand for the selected variant; null = unknown, so nothing is capped.
  // Derived (not synced through an effect) so switching to a variant with less
  // stock immediately pulls the quantity down.
  const maxQty = variant?.availableQty ?? null;
  const qty = maxQty !== null && maxQty > 0 ? Math.min(wantedQty, maxQty) : wantedQty;

  function increase() {
    if (maxQty !== null && qty >= maxQty) {
      setLimitMessage(stockLimitMessage(maxQty));
      return;
    }
    setLimitMessage(null);
    setQty(qty + 1);
  }

  function decrease() {
    setLimitMessage(null);
    setQty(Math.max(1, qty - 1));
  }

  async function addToCart() {
    if (!variant) return;
    setPending(true);
    try {
      await addLine(variant.publicId, qty);
      toast.success('Added to cart');
    } catch (err) {
      const message = cartErrorMessage(err, 'Could not add to cart. Please try again.');
      setLimitMessage(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function buyNow() {
    if (!variant) return;
    setPending(true);
    try {
      await addLine(variant.publicId, qty);
      router.push('/cart');
    } catch (err) {
      const message = cartErrorMessage(err, 'Could not add to cart. Please try again.');
      setLimitMessage(message);
      toast.error(message);
      setPending(false);
    }
  }

  async function toggleWishlistProduct() {
    const result = await toggleWishlist(productId);
    if (result === 'login-required') toast.error('Log in to save items to your wishlist.');
    else if (result === 'error') toast.error('Could not update your wishlist. Please try again.');
  }

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ url, title: document.title }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied to clipboard'));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-jet">Quantity</span>
        <div className="flex items-center gap-1 rounded-xl border border-ghost bg-ivory px-1">
          <Button variant="ghost" size="icon-sm" onClick={decrease} aria-label="Decrease quantity">
            <MinusIcon className="size-4" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold text-jet">{qty}</span>
          <Button variant="ghost" size="icon-sm" onClick={increase} aria-label="Increase quantity">
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>
      {limitMessage ? (
        <p role="alert" className="-mt-2 text-sm font-medium text-destructive">
          {limitMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="cta" size="lg" disabled={!canPurchase || pending} onClick={addToCart} className="flex-1">
          {inStock ? 'Add to Bag' : 'Out of Stock'}
        </Button>
        <Button variant="outline" size="lg" disabled={!canPurchase || pending} onClick={buyNow} className="flex-1">
          Buy Now
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={toggleWishlistProduct}
        >
          {isWishlisted ? <HeartIconSolid className="size-5 text-rose" /> : <HeartIcon className="size-5" />}
        </Button>
        <Button variant="outline" size="icon-lg" aria-label="Share this product" onClick={share}>
          <ShareIcon className="size-5" />
        </Button>
      </div>

      {/* Mobile sticky add-to-bag bar, matching the reference theme — reuses
          this component's own qty/addToCart/wishlist state directly rather
          than a second, divergent implementation elsewhere. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-ghost bg-white p-4 shadow-lg lg:hidden">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={toggleWishlistProduct}
          className={`size-12 shrink-0 rounded-xl border-2 ${isWishlisted ? 'border-rose text-rose' : 'border-ghost text-charcoal'}`}
        >
          {isWishlisted ? <HeartIconSolid className="size-5" /> : <HeartIcon className="size-5" />}
        </Button>
        <Button variant="cta" size="lg" disabled={!canPurchase || pending} onClick={addToCart} className="h-12 flex-1 rounded-xl">
          {inStock ? `Add to Bag${price !== null ? ` · ${formatPrice(price, currency)}` : ''}` : 'Out of Stock'}
        </Button>
      </div>
      <div className="h-20 lg:hidden" />
    </div>
  );
}

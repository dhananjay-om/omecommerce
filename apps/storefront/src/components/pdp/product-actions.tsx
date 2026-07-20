'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HeartIcon, ShareIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart-store';
import { useWishlistStore } from '@/store/wishlist-store';
import type { ProductVariant } from '@/types/product';

export function ProductActions({
  productId,
  variant,
  inStock,
}: {
  productId: string;
  variant: ProductVariant | undefined;
  inStock: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, setPending] = useState(false);
  const addLine = useCartStore((s) => s.addLine);
  const isWishlisted = useWishlistStore((s) => s.has(productId));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  const canPurchase = inStock && !!variant;

  async function addToCart() {
    if (!variant) return;
    setPending(true);
    try {
      await addLine(variant.publicId, qty);
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart. Please try again.');
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
    } catch {
      toast.error('Could not add to cart. Please try again.');
      setPending(false);
    }
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
        <span className="text-sm font-medium">Quantity</span>
        <div className="flex items-center rounded-lg border">
          <Button variant="ghost" size="icon-sm" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            <MinusIcon className="size-4" />
          </Button>
          <span className="w-8 text-center text-sm">{qty}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="cta" size="lg" disabled={!canPurchase || pending} onClick={addToCart} className="flex-1">
          {inStock ? 'Add to Cart' : 'Out of Stock'}
        </Button>
        <Button variant="outline" size="lg" disabled={!canPurchase || pending} onClick={buyNow} className="flex-1">
          Buy Now
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={() => toggleWishlist(productId)}
        >
          {isWishlisted ? <HeartIconSolid className="size-5 text-destructive" /> : <HeartIcon className="size-5" />}
        </Button>
        <Button variant="outline" size="icon-lg" aria-label="Share this product" onClick={share}>
          <ShareIcon className="size-5" />
        </Button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { HeartIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWishlistStore } from '@/store/wishlist-store';

/** Real count from the shared wishlist store — same store every product
 *  card/PDP heart reads/writes, so this updates the instant any of them
 *  toggle, not just on a page reload. Matches MiniCart's own badge
 *  treatment exactly (position, size, champagne background). */
export function WishlistIcon() {
  const count = useWishlistStore((s) => s.productIds.size);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Wishlist"
      render={<Link href="/account/wishlist" />}
      nativeButton={false}
      className="relative hidden sm:inline-flex"
    >
      <HeartIcon className="size-5" />
      {count > 0 ? (
        <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full bg-champagne px-1 text-[10px] text-white">
          {count}
        </Badge>
      ) : null}
    </Button>
  );
}

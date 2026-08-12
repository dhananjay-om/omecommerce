import Link from 'next/link';
import { PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';

/** Static top bar (plan/14 Phase 1) — location + support number + a rotating-offer slot on the left, low-emphasis account/help links on the right. The real, interactive login/wishlist/cart controls live in the sticky main header below. */
export function AnnouncementBar() {
  return (
    <div className="hidden bg-foreground text-background md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <MapPinIcon className="size-3.5" />
            Ship to United States
          </span>
          <span className="flex items-center gap-1">
            <PhoneIcon className="size-3.5" />
            +1 (800) 555-0199
          </span>
          <span className="hidden text-background/80 lg:inline">Free shipping on orders over $50</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/orders/track" className="hover:underline">
            Track Order
          </Link>
          <Link href="/contact" className="hover:underline">
            Help
          </Link>
        </div>
      </div>
    </div>
  );
}

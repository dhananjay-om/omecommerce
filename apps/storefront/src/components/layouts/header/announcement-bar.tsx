import Link from 'next/link';
import { PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { getCmsBlockOrUndefined } from '@/services/content.service';

/**
 * Top bar — location/support/shipping-line content on the left, low-
 * emphasis account/help links on the right. The real, interactive login/
 * wishlist/cart controls live in the sticky main header below.
 *
 * The left cluster is content-managed: if a `global_announcement_bar`
 * CmsBlock exists and is published, its raw HTML replaces the hardcoded
 * ship-to/phone/shipping-line text (admin-authored via Content > Blocks —
 * global site chrome, not homepage-specific, so it isn't part of the
 * Top/Middle/Footer widget-zone system). Track Order/Help stay coded
 * links (functional nav, not content). Falls back to today's exact
 * hardcoded left cluster when the block is missing/unpublished.
 */
export async function AnnouncementBar() {
  const block = await getCmsBlockOrUndefined('global_announcement_bar');

  return (
    <div className="hidden bg-foreground text-background md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
        {block ? (
          <div className="flex items-center gap-4 [&_a]:underline" dangerouslySetInnerHTML={{ __html: block.body }} />
        ) : (
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
        )}
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

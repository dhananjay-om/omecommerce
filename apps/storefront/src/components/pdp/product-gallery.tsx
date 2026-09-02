'use client';

import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Zoom, Thumbs, FreeMode } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/zoom';
import 'swiper/css/thumbs';
import 'swiper/css/free-mode';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import type { ProductMedia } from '@/types/product';
import { resolveProductImage } from '@/lib/mock-images';
import { useWishlistStore } from '@/store/wishlist-store';

/**
 * ÉLUME restyle: on `sm:` and up, the thumbnail strip moves to a vertical
 * column beside the main image (matching the reference theme's gallery),
 * via Swiper's per-breakpoint `direction` override — same Zoom/Thumbs/
 * FreeMode modules as before, only the layout direction changes. Below
 * `sm:` it stays the original horizontal strip under the image; a narrow
 * vertical column doesn't have room on a phone-width screen.
 *
 * Each image slot renders `resolveProductImage(sku, productName, item.url)`
 * — a real photo (each media row's own distinct `item.url`, so a real
 * product with several real photos still shows all of them, not one
 * repeated mock) wins unless `sku` is one of the seed script's known-fake
 * placeholder products, matching ProductCard's exact same resolution so
 * the two never disagree about which image a given product shows.
 *
 * The discount badge and wishlist heart overlaid on the main image match
 * the reference theme's gallery exactly — both real: the discount is
 * computed from the product's own representative price/mrp (not the
 * live-selected variant, which lives in a separate client component —
 * same simplification the theme's own static badge makes), and the heart
 * reads/writes the same `useWishlistStore` ProductActions already uses,
 * so toggling here or in the purchase panel stays in sync automatically
 * (same store, no prop-drilling needed). No "New" badge: there's no real
 * signal for that on a single product page (unlike the Home carousels,
 * which know their own section is "New Arrivals").
 */
export function ProductGallery({
  media,
  productName,
  sku,
  productId,
  price,
  mrp,
}: {
  media: ProductMedia[];
  productName: string;
  sku: string;
  productId: string;
  price: string | null;
  mrp: string | null;
}) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const isWishlisted = useWishlistStore((s) => s.has(productId));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  const priceNum = price ? Number(price) : null;
  const mrpNum = mrp ? Number(mrp) : null;
  const percentOff = priceNum !== null && mrpNum !== null && mrpNum > priceNum ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : null;

  if (media.length === 0) {
    return (
      <div className="flex aspect-[5/6] items-center justify-center rounded-2xl bg-sand text-sm text-slate">
        No image available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:gap-4">
      {/* aspect-ratio lives on THIS wrapper, not on the Swiper element itself — Swiper
          (especially with the Zoom module) actively measures/resizes its own root, and an
          aspect-ratio box whose height depends on a width Swiper can influence creates a
          resize-observer feedback loop; confirmed live (a real production PDP) that this
          loop runs away until Chromium clamps it at its ~33,554,432px max render size,
          which visually blanks the image and pushes the whole right-hand column (product
          tabs included) off-screen. The Swiper itself just fills this fixed-aspect box via
          absolute positioning, so its own layout can never feed back into its container's size. */}
      {/* aspect-[5/6] — a middle ground, confirmed live against real product photos: many
          are outdoor shots with background (trees, props) visible on both sides of the
          subject at full frame width. Cropping width is never possible here (object-cover
          on a box this shape or wider never trims left/right, only top/bottom), so a full
          square crop just removes the sky/ground that used to dilute those side edges,
          making the background more prominent, not less. 5/6 (~20% taller than square)
          keeps more of that breathing room while staying meaningfully shorter than the
          original 3/4. A real fix for the side backgrounds themselves needs tighter-
          cropped source photos, not a box-shape change — flagged to the user as such. */}
      <div className="relative aspect-[5/6] flex-1 overflow-hidden rounded-2xl bg-sand">
        <Swiper
          modules={[Zoom, Thumbs]}
          zoom
          thumbs={{ swiper: thumbsSwiper }}
          className="absolute inset-0 size-full"
        >
          {media.map((item) => (
            <SwiperSlide key={item.productMediaId}>
              <div className="swiper-zoom-container">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL when real, curated stock photo otherwise */}
                <img src={resolveProductImage(sku, productName, item.url, 1000)} alt={item.altText ?? productName} className="size-full object-cover" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {percentOff !== null ? (
          <span className="pointer-events-none absolute top-4 left-4 z-10 rounded-full bg-rose px-2.5 py-1 text-[10px] font-semibold text-white">
            {percentOff}% off
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => toggleWishlist(productId)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full shadow-sm transition-all ${
            isWishlisted ? 'bg-rose text-white' : 'bg-white text-charcoal hover:bg-rose hover:text-white'
          }`}
        >
          {isWishlisted ? <HeartIconSolid className="size-4" /> : <HeartIcon className="size-4" />}
        </button>
      </div>
      {media.length > 1 ? (
        <Swiper
          modules={[Thumbs, FreeMode]}
          onSwiper={setThumbsSwiper}
          freeMode
          watchSlidesProgress
          slidesPerView={5}
          spaceBetween={8}
          direction="horizontal"
          breakpoints={{ 640: { direction: 'vertical', slidesPerView: 5, spaceBetween: 10 } }}
          // Swiper needs an explicit height AND width on the container
          // itself — unlike the main gallery above (sized via `aspect-
          // square w-full` on the Swiper element directly), each
          // thumbnail's own `aspect-square` div can't give the *outer*
          // `.swiper`/`.swiper-wrapper` a size on its own. Without `w-full`
          // here, Swiper's slidesPerView={5} math resolves against
          // whatever tiny intrinsic width the container falls back to
          // (confirmed live: ~34px instead of the real gallery width),
          // so the whole row rendered as a near-invisible sliver even
          // after fixing the height alone. The vertical `sm:` branch needs
          // the same for height instead of width.
          className="thumbs-swiper h-16 w-full sm:h-[520px] sm:w-20"
        >
          {media.map((item) => (
            <SwiperSlide key={item.productMediaId} className="cursor-pointer">
              <div className="aspect-square overflow-hidden rounded-xl border-2 border-transparent opacity-60 transition-opacity [.swiper-slide-thumb-active_&]:border-jet [.swiper-slide-thumb-active_&]:opacity-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL when real, curated stock photo otherwise */}
                <img src={resolveProductImage(sku, productName, item.url, 200)} alt="" className="size-full object-cover" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : null}
      <p className="text-center text-xs text-slate sm:hidden">Double-click or pinch to zoom</p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Zoom, Thumbs, FreeMode } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/zoom';
import 'swiper/css/thumbs';
import 'swiper/css/free-mode';
import type { ProductMedia } from '@/types/product';
import { mockProductPhoto } from '@/lib/mock-images';

/**
 * ÉLUME restyle: on `sm:` and up, the thumbnail strip moves to a vertical
 * column beside the main image (matching the reference theme's gallery),
 * via Swiper's per-breakpoint `direction` override — same Zoom/Thumbs/
 * FreeMode modules as before, only the layout direction changes. Below
 * `sm:` it stays the original horizontal strip under the image; a narrow
 * vertical column doesn't have room on a phone-width screen.
 *
 * Every image slot renders `mockProductPhoto(productName)`, not
 * `item.url` — same reasoning as ProductCard's own doc comment: this
 * store's real product images are all the same flat placeholder-generator
 * graphic, and `mockProductPhoto` being a pure function of the product
 * name is exactly what keeps this consistent with whatever card the
 * shopper clicked through from (same name in, same photo out, no
 * coordination needed between the two components). `media` itself still
 * comes from the real product — only the URL each slot renders is
 * swapped, so a real photo (once one exists) still needs its own
 * follow-up to stop being overridden here.
 */
export function ProductGallery({ media, productName }: { media: ProductMedia[]; productName: string }) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);

  if (media.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-2xl bg-sand text-sm text-slate">
        No image available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:gap-4">
      <Swiper
        modules={[Zoom, Thumbs]}
        zoom
        thumbs={{ swiper: thumbsSwiper }}
        className="aspect-[3/4] w-full flex-1 overflow-hidden rounded-2xl bg-sand"
      >
        {media.map((item) => (
          <SwiperSlide key={item.productMediaId}>
            <div className="swiper-zoom-container">
              {/* eslint-disable-next-line @next/next/no-img-element -- curated stock photo, not a remote asset next/image can optimize */}
              <img src={mockProductPhoto(productName, 1000)} alt={item.altText ?? productName} className="size-full object-cover" />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
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
                {/* eslint-disable-next-line @next/next/no-img-element -- curated stock photo, not a remote asset next/image can optimize */}
                <img src={mockProductPhoto(productName, 200)} alt="" className="size-full object-cover" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : null}
      <p className="text-center text-xs text-slate sm:hidden">Double-click or pinch to zoom</p>
    </div>
  );
}

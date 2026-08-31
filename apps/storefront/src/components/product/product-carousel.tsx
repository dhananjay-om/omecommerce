'use client';

import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import type { SearchHit } from '@/types/product';
import { ProductCard } from './product-card';

export function ProductCarousel({
  title,
  subtitle,
  hits,
  seeAllHref,
  badge,
}: {
  title: string;
  /** Rendered as the small champagne eyebrow ABOVE the heading — matches the
   *  reference theme's section-header treatment (used everywhere else on the
   *  page too: Shop by Category, Featured Collections, ...). Not a
   *  description under the title. */
  subtitle?: string;
  hits: SearchHit[];
  seeAllHref?: string;
  /** Applied to every card in this carousel — real context the caller
   *  already has (e.g. "this is the Bestsellers rail"), not fabricated
   *  per-product data. Omit for a carousel with no such context (related
   *  products, recently viewed). */
  badge?: 'new' | 'bestseller';
}) {
  if (hits.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-10 flex items-end justify-between">
        <div>
          {subtitle ? <p className="text-xs font-medium tracking-[0.2em] text-champagne uppercase">{subtitle}</p> : null}
          <h2 className="font-display mt-1.5 text-4xl font-semibold text-jet">{title}</h2>
        </div>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-champagne transition-colors hover:text-jet sm:flex"
          >
            See all <span>→</span>
          </Link>
        ) : null}
      </div>
      <Swiper
        modules={[Navigation]}
        navigation
        spaceBetween={16}
        slidesPerView={2}
        breakpoints={{
          480: { slidesPerView: 2 },
          640: { slidesPerView: 3 },
          1024: { slidesPerView: 4 },
          1280: { slidesPerView: 5 },
        }}
      >
        {hits.map((hit) => (
          <SwiperSlide key={hit.productId}>
            <ProductCard hit={hit} badge={badge} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

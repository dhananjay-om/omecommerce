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
}: {
  title: string;
  subtitle?: string;
  hits: SearchHit[];
  seeAllHref?: string;
}) {
  if (hits.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {seeAllHref ? (
          <Link href={seeAllHref} className="shrink-0 text-sm font-medium text-primary hover:underline">
            See all
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
            <ProductCard hit={hit} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

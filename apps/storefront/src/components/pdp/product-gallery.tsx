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

export function ProductGallery({ media, productName }: { media: ProductMedia[]; productName: string }) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);

  if (media.length === 0) {
    return <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No image available</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Swiper
        modules={[Zoom, Thumbs]}
        zoom
        thumbs={{ swiper: thumbsSwiper }}
        className="aspect-square w-full overflow-hidden rounded-lg border bg-muted"
      >
        {media.map((item) => (
          <SwiperSlide key={item.productMediaId}>
            <div className="swiper-zoom-container">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic */}
              <img src={item.url} alt={item.altText ?? productName} className="size-full object-cover" />
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
          className="thumbs-swiper"
        >
          {media.map((item) => (
            <SwiperSlide key={item.productMediaId} className="cursor-pointer">
              <div className="aspect-square overflow-hidden rounded-md border bg-muted opacity-60 transition-opacity [.swiper-slide-thumb-active_&]:opacity-100 [.swiper-slide-thumb-active_&]:ring-2 [.swiper-slide-thumb-active_&]:ring-primary">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic */}
                <img src={item.url} alt="" className="size-full object-cover" />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">Double-click or pinch to zoom</p>
    </div>
  );
}

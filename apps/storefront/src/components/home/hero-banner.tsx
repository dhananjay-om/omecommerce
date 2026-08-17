'use client';

import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { Button } from '@/components/ui/button';

interface Slide {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  gradient: string;
}

/** Default slides, shown when the admin hasn't set anything under Content >
 *  Home Page (or the block is missing/unpublished/malformed) — see
 *  apps/storefront/src/app/page.tsx and lib/home-sections.ts for how the
 *  CMS-managed override is resolved and validated. */
const DEFAULT_SLIDES: Slide[] = [
  {
    eyebrow: 'New Season',
    title: 'Upgrade Your Everyday',
    subtitle: 'Fresh electronics, apparel, and home essentials — all in one place.',
    ctaLabel: 'Shop Now',
    ctaHref: '/products',
    gradient: 'from-primary to-blue-700',
  },
  {
    eyebrow: 'Limited Time',
    title: 'Up to 30% Off Electronics',
    subtitle: 'Laptops, phones, and audio — priced to move.',
    ctaLabel: 'Shop Electronics',
    ctaHref: '/collections/electronics',
    gradient: 'from-indigo-600 to-violet-700',
  },
  {
    eyebrow: 'Just Landed',
    title: 'Fashion for Every Season',
    subtitle: 'New arrivals across men’s and women’s collections.',
    ctaLabel: 'Shop Fashion',
    ctaHref: '/collections/fashion',
    gradient: 'from-rose-600 to-orange-600',
  },
];

export function HeroBanner({ slides }: { slides?: Slide[] }) {
  const activeSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES;
  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      autoplay={{ delay: 5000, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      loop
      className="hero-banner-swiper"
    >
      {activeSlides.map((slide, i) => (
        <SwiperSlide key={i}>
          <div className={`bg-gradient-to-br ${slide.gradient} px-6 py-20 text-white sm:py-28`}>
            <div className="mx-auto flex max-w-7xl flex-col items-start gap-4">
              <span className="text-sm font-semibold tracking-wide uppercase text-white/80">{slide.eyebrow}</span>
              <h1 className="max-w-xl text-3xl font-bold sm:text-5xl">{slide.title}</h1>
              <p className="max-w-md text-white/90">{slide.subtitle}</p>
              <Button variant="cta" size="lg" render={<Link href={slide.ctaHref} />} nativeButton={false} className="mt-2">
                {slide.ctaLabel}
              </Button>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}

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
  /** A real uploaded banner image (Content > Banners) takes priority when set; `gradient` is the backdrop otherwise. */
  imageUrl?: string | null;
  gradient: string;
}

/** Default slides, shown when no HERO_BANNER_SLIDER widget has any active
 *  Banner rows yet (Content > Widgets / Content > Banners) — see
 *  apps/storefront/src/components/widgets/widget-renderer.tsx for how the
 *  real Banner-backed slides are built. */
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
          <div
            className={`bg-cover bg-center px-6 py-20 text-white sm:py-28 ${slide.imageUrl ? '' : `bg-gradient-to-br ${slide.gradient}`}`}
            style={slide.imageUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${slide.imageUrl})` } : undefined}
          >
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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import { HERO_PHOTOS } from '@/lib/mock-images';

interface Slide {
  eyebrow: string;
  /** `\n` breaks to a new line — the reference theme's headlines are always 2-3 short lines. */
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /** A real uploaded banner image (Content > Banners) takes priority when set; `gradient` is the backdrop otherwise. */
  imageUrl?: string | null;
  gradient: string;
}

/** Default slides, shown when no HERO_BANNER_SLIDER widget has any active
 *  Banner rows yet (Content > Widgets / Content > Banners) — mirrors the
 *  reference theme's own 3-slide hero, adapted to this store's real
 *  top-level categories (electronics/fashion/home-kitchen) instead of a
 *  fashion-only women/men/accessories split. Images are curated stock
 *  photography (see lib/mock-images.ts) — this store has no real banner
 *  imagery configured yet. */
const DEFAULT_SLIDES: Slide[] = [
  {
    eyebrow: 'New Season',
    title: 'Tech that\nfits your\nlife.',
    subtitle: 'The latest electronics — sound, screens, and everything smart.',
    ctaLabel: 'Shop Electronics',
    ctaHref: '/collections/electronics',
    secondaryLabel: 'View sale',
    secondaryHref: '/offers',
    imageUrl: HERO_PHOTOS.electronics,
    gradient: 'from-jet to-charcoal',
  },
  {
    eyebrow: 'Fresh Drops',
    title: 'Everyday\nstyle,\nelevated.',
    subtitle: 'Fashion that works as hard as you do.',
    ctaLabel: 'Shop Fashion',
    ctaHref: '/collections/fashion',
    secondaryLabel: 'New arrivals',
    secondaryHref: '/products',
    imageUrl: HERO_PHOTOS.fashion,
    gradient: 'from-charcoal to-champagne',
  },
  {
    eyebrow: 'Make It Home',
    title: "Spaces\nyou'll\nlove.",
    subtitle: 'Home and kitchen essentials, chosen with care.',
    ctaLabel: 'Shop Home & Kitchen',
    ctaHref: '/collections/home-kitchen',
    secondaryLabel: 'Browse all',
    secondaryHref: '/products',
    imageUrl: HERO_PHOTOS.homeKitchen,
    gradient: 'from-rose to-jet',
  },
];

export function HeroBanner({ slides }: { slides?: Slide[] }) {
  const activeSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES;
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [active, setActive] = useState(0);

  return (
    <section className="relative h-[92vh] min-h-[600px] overflow-hidden">
      <Swiper
        modules={[Autoplay]}
        autoplay={{ delay: 5800, disableOnInteraction: false }}
        loop
        speed={500}
        onSwiper={setSwiper}
        onSlideChange={(s) => setActive(s.realIndex)}
        className="h-full"
      >
        {activeSlides.map((slide, i) => (
          <SwiperSlide key={i}>
            <div
              className={`relative h-full w-full bg-cover bg-center ${slide.imageUrl ? '' : `bg-gradient-to-br ${slide.gradient}`}`}
              style={slide.imageUrl ? { backgroundImage: `url(${slide.imageUrl})` } : undefined}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />

              <div className="relative z-10 flex h-full items-end">
                <div className="mx-auto flex w-full max-w-7xl flex-col items-end justify-between gap-8 px-6 pb-16 sm:flex-row sm:px-10 sm:pb-20">
                  <div>
                    <div className="mb-5 flex items-center gap-3">
                      <div className="h-px w-10 bg-champagne" />
                      <span className="text-xs font-medium tracking-[0.2em] text-champagne-light uppercase">{slide.eyebrow}</span>
                    </div>
                    <h1 className="font-display text-[clamp(3rem,9vw,7rem)] leading-[0.95] font-semibold whitespace-pre-line text-white">
                      {slide.title}
                    </h1>
                    <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65 sm:text-base">{slide.subtitle}</p>
                    <div className="mt-7 flex items-center gap-4">
                      <Link
                        href={slide.ctaHref}
                        className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-jet shadow-lg transition-all duration-300 hover:bg-champagne hover:text-white"
                      >
                        {slide.ctaLabel}
                      </Link>
                      {slide.secondaryLabel && slide.secondaryHref ? (
                        <Link
                          href={slide.secondaryHref}
                          className="text-sm font-medium text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
                        >
                          {slide.secondaryLabel}
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="hidden flex-col items-end gap-3 sm:flex">
                    <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-right backdrop-blur-md">
                      <p className="text-[10px] tracking-widest text-white/50 uppercase">Free shipping</p>
                      <p className="mt-0.5 text-sm font-semibold text-white">On orders over $50</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-right backdrop-blur-md">
                      <p className="text-[10px] tracking-widest text-white/50 uppercase">Easy returns</p>
                      <p className="mt-0.5 text-sm font-semibold text-white">30-day hassle free</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Slide counter */}
      <div className="absolute top-8 right-8 z-10">
        <span className="text-sm font-light text-white/80 tabular-nums">
          0{active + 1} / 0{activeSlides.length}
        </span>
      </div>

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {activeSlides.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => swiper?.slideToLoop(i)}
            className={`rounded-full transition-all duration-300 ${i === active ? 'h-2 w-6 bg-white' : 'h-2 w-2 bg-white/35 hover:bg-white/60'}`}
          />
        ))}
      </div>

      {/* Vertical scroll hint */}
      <div className="absolute top-1/2 left-5 z-10 hidden -translate-y-1/2 flex-col items-center gap-3 xl:flex">
        <div className="h-12 w-px bg-white/25" />
        <span className="text-[10px] tracking-[0.25em] text-white/40 uppercase" style={{ writingMode: 'vertical-rl' }}>
          Scroll to explore
        </span>
      </div>
    </section>
  );
}

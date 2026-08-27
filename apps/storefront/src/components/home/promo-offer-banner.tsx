import Link from 'next/link';
import { OFFER_BANNER_PHOTO } from '@/lib/mock-images';

const TRUST_ITEMS = ['Free shipping', '30-day returns', 'Genuine products'];

/**
 * Full-width dark promotional band, matching the reference theme's own
 * "Up to 40% off" section — genuinely new to this storefront (nothing like
 * it existed before this restyle). Not CMS-driven (unlike HeroBanner/
 * PromoBanners) — a single fixed piece of page furniture, same posture as
 * NewsletterSection/InstagramGallery sitting outside the widget system.
 * The background photo is curated stock imagery (lib/mock-images.ts), same
 * "no real banner asset exists yet" reasoning as the hero/collections.
 */
export function PromoOfferBanner() {
  return (
    <section className="relative overflow-hidden bg-jet">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- curated stock photo, not app-managed content */}
        <img src={OFFER_BANNER_PHOTO} alt="" className="h-full w-full object-cover object-top opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-jet via-jet/90 to-jet/60" />
      </div>
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 py-20 sm:flex-row sm:px-10 sm:py-28">
        <div className="flex-1">
          <span className="text-xs font-semibold tracking-[0.2em] text-champagne uppercase">Limited time offer</span>
          <h3 className="font-display mt-3 text-5xl leading-[1.0] font-semibold text-white sm:text-6xl">
            Up to 40% off.
            <br />
            <em className="font-normal text-white/50 not-italic">Yes, really.</em>
          </h3>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/45">
            Thoughtfully selected pieces at prices that make sense. No gimmicks, just a sale worth your time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/offers" className="rounded-full bg-champagne px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-white hover:text-jet">
              Browse the sale
            </Link>
            <Link href="/products" className="rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white/80 transition-all duration-300 hover:border-white hover:text-white">
              New arrivals
            </Link>
          </div>
        </div>
        <div className="hidden flex-col gap-3 sm:flex">
          {TRUST_ITEMS.map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-5 py-3 backdrop-blur-sm">
              <span className="text-lg text-champagne">✓</span>
              <span className="text-sm font-medium text-white/80">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

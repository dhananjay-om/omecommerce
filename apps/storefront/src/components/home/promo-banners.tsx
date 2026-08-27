import Link from 'next/link';

interface Banner {
  title: string;
  subtitle: string;
  href: string;
  /** A real uploaded banner image (Content > Banners) takes priority when set; `gradient` is the backdrop otherwise. */
  imageUrl?: string | null;
  gradient: string;
}

/** Default 2x2 promo grid, shown when no PROMO_BANNER_GRID widget has any
 *  active Banner rows yet — see widgets/widget-renderer.tsx. */
const DEFAULT_BANNERS: Banner[] = [
  { title: 'Electronics Sale', subtitle: 'Up to 30% off', href: '/collections/electronics', gradient: 'from-jet to-charcoal' },
  { title: 'New in Fashion', subtitle: 'Shop the latest', href: '/collections/fashion', gradient: 'from-rose to-champagne' },
  { title: 'Home & Kitchen', subtitle: 'Upgrade your space', href: '/collections/home-kitchen', gradient: 'from-champagne to-charcoal' },
  { title: 'Accessories', subtitle: 'Complete the look', href: '/products', gradient: 'from-charcoal to-jet' },
];

export function PromoBanners({ banners }: { banners?: Banner[] }) {
  const activeBanners = banners && banners.length > 0 ? banners : DEFAULT_BANNERS;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {activeBanners.map((banner, i) => (
          <Link
            key={i}
            href={banner.href}
            className={`group flex flex-col justify-center gap-1 rounded-3xl bg-cover bg-center px-8 py-12 text-white transition-transform hover:-translate-y-0.5 ${banner.imageUrl ? '' : `bg-gradient-to-br ${banner.gradient}`}`}
            style={
              banner.imageUrl
                ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${banner.imageUrl})` }
                : undefined
            }
          >
            <span className="font-display text-2xl font-semibold">{banner.title}</span>
            <span className="text-sm text-white/85">{banner.subtitle}</span>
            <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm transition-colors group-hover:bg-white/25">
              Shop Now →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

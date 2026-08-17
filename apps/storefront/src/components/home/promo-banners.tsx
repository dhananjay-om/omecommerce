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
  { title: 'Electronics Sale', subtitle: 'Up to 30% off', href: '/collections/electronics', gradient: 'from-blue-600 to-indigo-700' },
  { title: 'New in Fashion', subtitle: 'Shop the latest', href: '/collections/fashion', gradient: 'from-rose-500 to-pink-600' },
  { title: 'Home & Kitchen', subtitle: 'Upgrade your space', href: '/collections/home-kitchen', gradient: 'from-amber-600 to-orange-700' },
  { title: 'Accessories', subtitle: 'Complete the look', href: '/products', gradient: 'from-emerald-600 to-teal-700' },
];

export function PromoBanners({ banners }: { banners?: Banner[] }) {
  const activeBanners = banners && banners.length > 0 ? banners : DEFAULT_BANNERS;
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {activeBanners.map((banner, i) => (
          <Link
            key={i}
            href={banner.href}
            className={`flex flex-col justify-center gap-1 rounded-lg bg-cover bg-center px-6 py-10 text-white ${banner.imageUrl ? '' : `bg-gradient-to-br ${banner.gradient}`}`}
            style={
              banner.imageUrl
                ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${banner.imageUrl})` }
                : undefined
            }
          >
            <span className="text-lg font-bold">{banner.title}</span>
            <span className="text-sm text-white/85">{banner.subtitle}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

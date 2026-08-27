import Link from 'next/link';
import { COLLECTION_PHOTOS } from '@/lib/mock-images';

interface Banner {
  title: string;
  subtitle: string;
  href: string;
  /** A real uploaded banner image (Content > Banners) takes priority when set; `gradient` is the backdrop otherwise. */
  imageUrl?: string | null;
  gradient: string;
}

/** Default 3-card "Featured Collections", shown when no PROMO_BANNER_GRID
 *  widget has any active Banner rows yet — see widgets/widget-renderer.tsx.
 *  Adapted to this store's real top-level categories, curated stock photos
 *  (see lib/mock-images.ts) since no Banner has a real image configured. */
const DEFAULT_BANNERS: Banner[] = [
  { title: 'Electronics Edit', subtitle: 'Sound, screens, and everything smart', href: '/collections/electronics', imageUrl: COLLECTION_PHOTOS.electronics, gradient: 'from-jet to-charcoal' },
  { title: 'Home Refresh', subtitle: 'Kitchen and home essentials worth having', href: '/collections/home-kitchen', imageUrl: COLLECTION_PHOTOS.homeKitchen, gradient: 'from-charcoal to-champagne' },
  { title: 'Up to 40% Off', subtitle: 'Great pieces at honest prices — no gimmicks', href: '/offers', imageUrl: COLLECTION_PHOTOS.fashion, gradient: 'from-rose to-jet' },
];

export function PromoBanners({ banners }: { banners?: Banner[] }) {
  const activeBanners = banners && banners.length > 0 ? banners : DEFAULT_BANNERS;
  return (
    <section className="bg-ivory py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-champagne uppercase">Curated for you</p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-jet sm:text-4xl">Featured Collections</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {activeBanners.map((banner, i) => (
            <Link
              key={i}
              href={banner.href}
              className={`group relative block aspect-[3/4] overflow-hidden rounded-3xl sm:aspect-[4/5] ${banner.imageUrl ? '' : `bg-gradient-to-br ${banner.gradient}`}`}
            >
              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URL when real, curated stock photo otherwise
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <p className="font-display text-2xl leading-tight font-semibold text-white">{banner.title}</p>
                <p className="mt-1.5 text-sm leading-snug text-white/65">{banner.subtitle}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-jet transition-all duration-300 group-hover:bg-champagne group-hover:text-white">
                  Explore →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

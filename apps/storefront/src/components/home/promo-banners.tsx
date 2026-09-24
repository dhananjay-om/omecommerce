import Link from 'next/link';
import { COLLECTION_PHOTOS } from '@/lib/mock-images';
import { safeInlineHtml } from '@/lib/safe-inline-html';
import { getCmsBlockOrUndefined } from '@/services/content.service';
import { listBanners } from '@/services/banner.service';

interface Banner {
  title: string;
  subtitle: string;
  href: string;
  /** Button text (Content > Banners > Button Text); blank → "Explore →". */
  ctaLabel?: string;
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

/** Section heading area: an admin-managed CMS block (`home_featured_collections`,
 *  Content > Blocks) — a paragraph above the heading becomes the small eyebrow line,
 *  the heading is the title, a paragraph below it is the intro text, and any link is
 *  styled as a text link. Unpublished/missing → the original "Curated for you /
 *  Featured Collections" header. */
const HEADER_CLASS =
  'mb-10 text-center [&_a]:font-medium [&_a]:text-champagne [&_a]:underline [&_h2]:font-display [&_h2]:mt-2 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:text-jet sm:[&_h2]:text-4xl [&_p]:mx-auto [&_p]:mt-2 [&_p]:max-w-2xl [&_p]:text-sm [&_p]:text-slate [&>p:has(+h2)]:mt-0 [&>p:has(+h2)]:max-w-none [&>p:has(+h2)]:text-xs [&>p:has(+h2)]:font-medium [&>p:has(+h2)]:tracking-[0.2em] [&>p:has(+h2)]:text-champagne [&>p:has(+h2)]:uppercase';

const FALLBACK_GRADIENTS = ['from-jet to-charcoal', 'from-charcoal to-champagne', 'from-rose to-jet'];

/** `banners` comes from a placed PROMO_BANNER_GRID widget (Content > Widgets). Without one,
 *  the section still shows whatever active Promo banners exist (Content > Banners) — and only
 *  when there are none at all does it fall back to the built-in demo cards. */
export async function PromoBanners({ banners }: { banners?: Banner[] }) {
  let cards = banners;
  if (!cards || cards.length === 0) {
    const promo = await listBanners('PROMO').catch(() => []);
    cards = promo.map((b, i) => ({
      title: b.title,
      subtitle: b.subtitle ?? '',
      href: b.ctaHref ?? '/products',
      ctaLabel: b.ctaLabel ?? undefined,
      imageUrl: b.imageUrl,
      gradient: b.gradient || FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length]!,
    }));
  }
  const activeBanners = cards.length > 0 ? cards : DEFAULT_BANNERS;
  const header = await getCmsBlockOrUndefined('home_featured_collections').catch(() => undefined);
  return (
    <section className="bg-ivory py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {header ? (
          <div className={HEADER_CLASS} dangerouslySetInnerHTML={{ __html: header.body }} />
        ) : (
          <div className="mb-10 text-center">
            <p className="text-xs font-medium tracking-[0.2em] text-champagne uppercase">Curated for you</p>
            <h2 className="font-display mt-2 text-3xl font-semibold text-jet sm:text-4xl">Featured Collections</h2>
          </div>
        )}
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
                  alt={banner.title.replace(/<[^>]*>/g, '')}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <p className="font-display text-2xl leading-tight font-semibold text-white" dangerouslySetInnerHTML={{ __html: safeInlineHtml(banner.title) }} />
                <p className="mt-1.5 text-sm leading-snug text-white/65" dangerouslySetInnerHTML={{ __html: safeInlineHtml(banner.subtitle) }} />
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-jet transition-all duration-300 group-hover:bg-champagne group-hover:text-white">
                  {banner.ctaLabel?.trim() || 'Explore →'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

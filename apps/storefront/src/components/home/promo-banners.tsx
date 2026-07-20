import Link from 'next/link';

/** Static 2x2 promo grid for v1 — see hero-banner.tsx's doc comment on why (no CMS banner schema). */
const BANNERS = [
  { id: 'electronics', title: 'Electronics Sale', subtitle: 'Up to 30% off', href: '/collections/electronics', className: 'from-blue-600 to-indigo-700' },
  { id: 'fashion', title: 'New in Fashion', subtitle: 'Shop the latest', href: '/collections/fashion', className: 'from-rose-500 to-pink-600' },
  { id: 'home', title: 'Home & Kitchen', subtitle: 'Upgrade your space', href: '/collections/home-kitchen', className: 'from-amber-600 to-orange-700' },
  { id: 'accessories', title: 'Accessories', subtitle: 'Complete the look', href: '/products', className: 'from-emerald-600 to-teal-700' },
];

export function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {BANNERS.map((banner) => (
          <Link
            key={banner.id}
            href={banner.href}
            className={`flex flex-col justify-center gap-1 rounded-lg bg-gradient-to-br px-6 py-10 text-white ${banner.className}`}
          >
            <span className="text-lg font-bold">{banner.title}</span>
            <span className="text-sm text-white/85">{banner.subtitle}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

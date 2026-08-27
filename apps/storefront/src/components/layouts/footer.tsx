'use client';

import Link from 'next/link';
import { TruckIcon, ArrowUturnLeftIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Website } from '@/types/website';

const trustStrip = [
  { icon: TruckIcon, title: 'Free Shipping', sub: 'On orders above $50' },
  { icon: ArrowUturnLeftIcon, title: 'Easy Returns', sub: '30-day hassle-free returns' },
  { icon: LockClosedIcon, title: 'Secure Payments', sub: '256-bit SSL encryption' },
  { icon: SparklesIcon, title: 'Authentic Products', sub: '100% genuine brands' },
];

const linkColumns = [
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/contact', label: 'Contact Us' },
      { href: '/offers', label: 'Offers' },
      { href: '/brands', label: 'Brands' },
    ],
  },
  {
    title: 'Customer Service',
    links: [
      { href: '/account/orders', label: 'Track Order' },
      { href: '/account', label: 'My Account' },
      { href: '/account/wishlist', label: 'Wishlist' },
      { href: '/contact', label: 'Help / FAQ' },
    ],
  },
];

const socialLinks = ['Facebook', 'Instagram', 'X', 'YouTube'];
const paymentMethods = ['Visa', 'Mastercard', 'Amex', 'PayPal', 'UPI'];

export function Footer({ website }: { website: Website }) {
  return (
    <footer className="mt-16 bg-foreground text-background">
      {/* Trust strip */}
      <div className="border-b border-background/10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
          {trustStrip.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <item.icon className="mt-0.5 size-5 shrink-0 text-champagne" />
              <div>
                <p className="text-sm font-semibold tracking-wide">{item.title}</p>
                <p className="mt-0.5 text-xs text-background/50">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <Link href="/" className="text-xl font-bold">
            {website.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
              <img src={website.logoUrl} alt={website.name} className="h-12 w-auto max-w-[200px] object-contain" />
            ) : (
              <span className="font-display text-2xl font-semibold tracking-[0.06em]">
                OME<span className="text-champagne">Shop</span>
              </span>
            )}
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-background/50">
            Everything you need, delivered fast. Quality products, honest prices.
          </p>
          <div className="mt-4 flex gap-3">
            {socialLinks.map((s) => (
              <span
                key={s}
                className="rounded-full border border-background/20 px-2.5 py-1 text-xs text-background/50 transition-colors hover:border-champagne hover:text-champagne"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {linkColumns.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-semibold tracking-widest text-background/70 uppercase">{col.title}</h3>
            <ul className="mt-4 flex flex-col gap-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-background/50 transition-colors hover:text-champagne">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-xs font-semibold tracking-widest text-background/70 uppercase">Newsletter</h3>
          <p className="mt-4 text-sm text-background/50">Get updates on new arrivals and offers.</p>
          <form className="mt-3 flex gap-0 overflow-hidden rounded-full border border-background/20" onSubmit={(e) => e.preventDefault()}>
            <Input
              type="email"
              placeholder="Email address"
              required
              className="rounded-none border-0 bg-transparent px-4 text-background placeholder:text-background/40 focus-visible:ring-0"
            />
            {/* Champagne override: the default cta button is jet, which would
                vanish against this footer's jet background — see the storefront
                restyle plan's Header/Footer phase notes. */}
            <Button type="submit" variant="cta" size="default" className="shrink-0 rounded-none bg-champagne px-5 hover:bg-champagne/90">
              Join
            </Button>
          </form>
        </div>
      </div>

      <div className="border-t border-background/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-background/40 sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} OMEShop. All rights reserved.</p>
          <div className="flex gap-2">
            {paymentMethods.map((p) => (
              <span key={p} className="rounded-md border border-background/20 px-2 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

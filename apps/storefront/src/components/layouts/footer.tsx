'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Website } from '@/types/website';

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
    <footer className="mt-16 border-t bg-foreground text-background">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="text-xl font-bold">
            {website.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned MinIO/S3 URLs are per-request and dynamic
              <img src={website.logoUrl} alt={website.name} className="h-8 w-auto object-contain" />
            ) : (
              <>
                OME<span className="text-cta">Shop</span>
              </>
            )}
          </Link>
          <p className="mt-3 max-w-xs text-sm text-background/70">
            Everything you need, delivered fast. Quality products, honest prices.
          </p>
          <div className="mt-4 flex gap-3 text-xs text-background/70">
            {socialLinks.map((s) => (
              <span key={s} className="rounded-full border border-background/30 px-2.5 py-1">
                {s}
              </span>
            ))}
          </div>
        </div>

        {linkColumns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-background/70 hover:text-background hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold">Newsletter</h3>
          <p className="mt-3 text-sm text-background/70">Get updates on new arrivals and offers.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input type="email" placeholder="Email address" required className="bg-background text-foreground" />
            <Button type="submit" variant="cta" size="default">
              Join
            </Button>
          </form>
        </div>
      </div>

      <div className="border-t border-background/20">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-background/60 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} OMEShop. All rights reserved.</p>
          <div className="flex gap-2">
            {paymentMethods.map((p) => (
              <span key={p} className="rounded border border-background/30 px-2 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

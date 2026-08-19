'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/wishlist', label: 'Wishlist' },
  { href: '/account/wallet', label: 'Wallet' },
  { href: '/account/rewards', label: 'Rewards' },
  { href: '/account/referrals', label: 'Referrals' },
  { href: '/account/company', label: 'Company' },
  { href: '/account/company/credit', label: 'Company Credit' },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto md:w-48 md:flex-col">
      {LINKS.map((link) => {
        // Exact-or-segment-boundary match — plain startsWith would also light up
        // "Company" while on "Company Credit" since one href prefixes the other.
        const active =
          link.href === '/account'
            ? pathname === '/account'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

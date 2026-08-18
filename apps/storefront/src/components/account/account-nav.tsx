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
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto md:w-48 md:flex-col">
      {LINKS.map((link) => {
        const active = link.href === '/account' ? pathname === '/account' : pathname.startsWith(link.href);
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

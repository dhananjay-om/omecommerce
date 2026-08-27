'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Customer } from '@/types/customer';

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

export function AccountNav({ customer }: { customer: Customer }) {
  const pathname = usePathname();
  const displayName = customer.firstName ? `${customer.firstName} ${customer.lastName ?? ''}`.trim() : customer.email;
  const initial = (customer.firstName ?? customer.email).charAt(0).toUpperCase();

  return (
    <div className="flex w-full shrink-0 flex-col gap-4 md:w-56">
      <div className="hidden items-center gap-3 rounded-2xl border border-ghost bg-ivory p-4 md:flex">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-jet text-lg font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-jet">{displayName}</p>
          <p className="truncate text-xs text-slate">{customer.email}</p>
        </div>
      </div>

      <nav className="flex w-full flex-row gap-1 overflow-x-auto md:flex-col">
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
              className={`shrink-0 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                active ? 'bg-jet text-white' : 'text-charcoal hover:bg-sand'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

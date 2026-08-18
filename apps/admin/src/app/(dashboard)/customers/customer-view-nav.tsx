'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
}

/** Same shape as orders/order-view-nav.tsx — Phase 3 appends Loyalty and Referrals here. */
export function CustomerViewNav({ customerPublicId }: { customerPublicId: string }) {
  const pathname = usePathname();
  const base = `/customers/${customerPublicId}`;

  const items: NavItem[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/wallet`, label: 'Wallet' },
  ];

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="border-b px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Customer View</div>
      <nav className="flex flex-col py-1">
        {items.map((item) => {
          const active = item.href === base ? pathname === base : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'border-l-2 px-4 py-2.5 text-sm transition-colors',
                active
                  ? 'border-l-primary bg-muted/50 font-semibold text-foreground'
                  : 'border-l-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

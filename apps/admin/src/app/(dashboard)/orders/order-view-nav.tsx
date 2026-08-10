'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
}

export function OrderViewNav({ orderPublicId }: { orderPublicId: string }) {
  const pathname = usePathname();
  const base = `/orders/${orderPublicId}`;

  const items: NavItem[] = [
    { href: base, label: 'Information' },
    { href: `${base}/invoices`, label: 'Invoices' },
    { href: `${base}/shipments`, label: 'Shipments' },
    { href: `${base}/emails`, label: 'Emails' },
    { href: `${base}/history`, label: 'Comments History' },
  ];

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="border-b px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Order View</div>
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

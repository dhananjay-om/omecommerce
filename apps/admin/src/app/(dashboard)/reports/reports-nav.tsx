'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
}

const ITEMS: NavItem[] = [
  { href: '/reports', label: 'Executive' },
  { href: '/reports/sales', label: 'Sales' },
  { href: '/reports/orders', label: 'Orders' },
  { href: '/reports/products', label: 'Products' },
  { href: '/reports/customers', label: 'Customers' },
  { href: '/reports/inventory', label: 'Inventory' },
  { href: '/reports/alerts', label: 'Alert Rules' },
];

/** Tab nav shared by every /reports/* page — same shape as orders'
 *  OrderViewNav (left rail, border-l active indicator), just not scoped to
 *  one entity id. */
export function ReportsNav() {
  const pathname = usePathname();

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="border-b px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Reports</div>
      <nav className="flex flex-col py-1">
        {ITEMS.map((item) => {
          const active = item.href === '/reports' ? pathname === '/reports' : pathname === item.href || pathname.startsWith(`${item.href}/`);
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

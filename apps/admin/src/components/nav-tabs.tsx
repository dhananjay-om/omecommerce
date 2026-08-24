'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface NavTabItem {
  href: string;
  label: string;
}

/** Horizontal, route-driven tab strip — visually matches `ui/tabs.tsx`'s
 *  `TabsList`/`TabsTrigger` styling, but each "tab" is a real `<Link>` to
 *  its own page rather than a base-ui controlled panel, since these always
 *  link between distinct Next.js routes (order detail's Information/
 *  Invoices/Shipments/Emails/History, customer detail's Overview/Wallet/
 *  Loyalty/Referrals, and Reports' 7 dashboards) — real navigation, not
 *  client-side panel toggling. Replaces the app's old bespoke left-rail
 *  sub-navs (`OrderViewNav`/`CustomerViewNav`/`ReportsNav`), unified into
 *  one shared component per the admin-UI-revamp plan. */
export function NavTabs({ items }: { items: NavTabItem[] }) {
  const pathname = usePathname();
  // Longest-prefix-match, same "one winner" logic as nav-data.ts's
  // bestMatchingNavItem — without it, a base route like "Information"
  // (href .../orders/{id}) would ALSO match every one of its own sibling
  // sub-routes' pathnames (.../orders/{id}/invoices starts with
  // .../orders/{id}/ too), so more than one tab would show active at once.
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              '-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors',
              'hover:text-foreground',
              active && 'border-primary text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

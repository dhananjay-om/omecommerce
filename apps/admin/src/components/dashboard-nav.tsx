'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Tag,
  ShoppingCart,
  Users,
  ListTree,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_GROUPS: Array<{ label: string | null; items: NavItem[] }> = [
  { label: null, items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/inventory', label: 'Inventory', icon: Boxes },
      { href: '/pricing', label: 'Pricing', icon: Tag },
      { href: '/attribute-sets', label: 'Attribute Sets', icon: ListTree },
      { href: '/attributes', label: 'Attributes', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingCart },
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? `group-${i}`}>
          {group.label ? (
            <div className="mb-1 px-3 text-xs font-medium tracking-wider text-sidebar-foreground/35 uppercase">
              {group.label}
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                      : 'font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground',
                  )}
                >
                  <Icon className="size-4" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

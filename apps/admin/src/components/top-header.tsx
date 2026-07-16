'use client';

import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';

const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  inventory: 'Inventory',
  pricing: 'Pricing',
  orders: 'Orders',
  customers: 'Customers',
};

export function TopHeader() {
  const pathname = usePathname();
  const section = pathname.split('/')[1] ?? '';
  const label = SECTION_LABELS[section] ?? 'Dashboard';

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-8">
      <span className="text-sm text-muted-foreground">
        Admin <span className="text-foreground">/ {label}</span>
      </span>
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          A
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">Admin</span>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}

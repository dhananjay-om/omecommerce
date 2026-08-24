import { NavTabs } from '@/components/nav-tabs';

/** Shared chrome for every /reports/* page (Executive/Sales/Orders/Products/
 *  Customers/Inventory/Marketing/Financial/Report Builder/Alert Rules) — a
 *  horizontal `NavTabs` strip (admin UI revamp, Phase 2 — replaces the old
 *  left-rail `ReportsNav`, same migration as orders/[id] and customers/[id]).
 *  Each page fetches its own data (different analytics endpoint per page),
 *  so this layout fetches nothing shared. */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <NavTabs
        items={[
          { href: '/reports', label: 'Executive' },
          { href: '/reports/sales', label: 'Sales' },
          { href: '/reports/orders', label: 'Orders' },
          { href: '/reports/products', label: 'Products' },
          { href: '/reports/customers', label: 'Customers' },
          { href: '/reports/inventory', label: 'Inventory' },
          { href: '/reports/marketing', label: 'Marketing' },
          { href: '/reports/financial', label: 'Financial' },
          { href: '/reports/builder', label: 'Report Builder' },
          { href: '/reports/alerts', label: 'Alert Rules' },
        ]}
      />
      <div className="mt-6 min-w-0">{children}</div>
    </div>
  );
}

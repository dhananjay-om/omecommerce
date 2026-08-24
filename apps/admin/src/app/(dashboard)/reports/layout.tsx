import { ReportsNav } from './reports-nav';

/** Shared chrome for every /reports/* page (Executive/Sales/Orders/Products/
 *  Customers/Inventory/Alert Rules) — same "left tab rail + content" shape as
 *  orders/[id]/layout.tsx, just not scoped to one entity. Each page fetches
 *  its own data (different analytics endpoint per page), so this layout
 *  fetches nothing shared. */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <ReportsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

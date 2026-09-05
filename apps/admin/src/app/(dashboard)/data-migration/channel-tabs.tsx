import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { MigrationChannel } from '@/lib/types';

const TABS: Array<{ value: MigrationChannel; label: string }> = [
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'MAGENTO', label: 'Magento' },
];

/** Shared by all 3 Data Migration pages (Catalog/Customers/Orders) — each
 *  channel has its OWN saved connection and its own independent Check
 *  Migration / Start / Stop run history (they don't share a connection
 *  the way Catalog/Customer/Order share the connection WITHIN one
 *  channel). Switching tabs is a plain link to `?channel=...`, so the
 *  page's own Server Component re-fetches that channel's real state —
 *  no client-side channel state to keep in sync. */
export function ChannelTabs({ basePath, channel }: { basePath: string; channel: MigrationChannel }) {
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={t.value === 'SHOPIFY' ? basePath : `${basePath}?channel=${t.value}`}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            channel === t.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

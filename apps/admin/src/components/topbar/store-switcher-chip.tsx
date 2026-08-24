'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** Matches the mock's `.tb-store-sel` chip — real website names (fetched
 *  server-side in the dashboard layout, same GET /admin/v1/websites every
 *  Stores page already uses), not the mock's own decorative fixed list.
 *  Selecting one is informational only for now (no page in this app scopes
 *  its data by the topbar's selection — every list page has its own
 *  website-aware filters where that matters), matching the mock's own
 *  scope: it never actually re-filtered anything either. */
export function StoreSwitcherChip({ websiteNames }: { websiteNames: string[] }) {
  const [selected, setSelected] = useState(websiteNames[0] ?? 'Store');
  if (websiteNames.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-ring/50">
        <span className="size-1.5 rounded-full bg-status-good" />
        <span className="max-w-32 truncate">{selected}</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {websiteNames.map((name) => (
          <DropdownMenuItem key={name} onClick={() => setSelected(name)}>
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

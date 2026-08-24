'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ALL_NAV_ITEMS } from '@/lib/nav-data';
import { cn } from '@/lib/utils';

/**
 * ⌘K / Ctrl+K global command palette — Phase 0 scope is navigation-only
 * (fuzzy-matches against `nav-data.ts`'s ALL_NAV_ITEMS, the same list the
 * sidebar renders). The mock's version also searches live orders/products/
 * customers by name/SKU/email; that needs a real search endpoint (or
 * reusing the existing list endpoints' query filters) and is a reasonable
 * Phase 2+ enhancement, not part of getting the shell/nav right first.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery('');
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q ? ALL_NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q)) : ALL_NAV_ITEMS.filter((item) => item.status === 'live').slice(0, 8);
    return items.slice(0, 20);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-80 shrink-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/50"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Search orders, products, customers…</span>
        <kbd className="shrink-0 rounded border border-input px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="top-[20%] max-w-lg translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or jump to…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results</p>
            ) : (
              results.map((item) => (
                <button
                  key={item.key}
                  onClick={() => go(item.href)}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted', 'text-foreground')}
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  {item.status === 'comingSoon' ? <span className="text-xs text-muted-foreground">Planned</span> : null}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

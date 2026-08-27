'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';

export function SearchBar({
  className,
  autoFocus,
  onClose,
}: {
  className?: string;
  /** Set when rendered inside MainHeader's toggle-open search row — focuses the input on mount. */
  autoFocus?: boolean;
  /** Present only in that same toggle context; renders a close (×) button that also clears the query. */
  onClose?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get('q');
        const query = typeof q === 'string' ? q.trim() : '';
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
    >
      <div className="relative flex w-full items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
          <Input
            ref={inputRef}
            name="q"
            type="search"
            placeholder="Search for styles, brands, or categories..."
            className="rounded-full border-ghost bg-sand pl-9 focus-visible:border-champagne focus-visible:bg-white focus-visible:ring-champagne/30"
            aria-label="Search products"
          />
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close search" className="shrink-0 text-slate transition-colors hover:text-jet">
            <XMarkIcon className="size-5" />
          </button>
        ) : null}
      </div>
    </form>
  );
}

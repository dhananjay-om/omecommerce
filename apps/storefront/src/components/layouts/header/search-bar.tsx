'use client';

import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Input } from '@/components/ui/input';

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();

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
      <div className="relative w-full">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" type="search" placeholder="Search products..." className="pl-8" aria-label="Search products" />
      </div>
    </form>
  );
}

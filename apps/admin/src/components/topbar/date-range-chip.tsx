'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

const RANGES = ['Today', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Month'];

/** Matches the mock's `.tb-daterange` chip exactly — cycles through a fixed
 *  label list on click. Decorative, same as the mock's own implementation
 *  (its click handler just cycles `DATE_RANGES` with no real filtering
 *  wired to any page either): every real dashboard in this app already has
 *  its own working date-range filter (see /reports/*), so this chip isn't
 *  a second, competing source of truth for "what range am I looking at" —
 *  it's global chrome, matching the mock's own scope for it. */
export function DateRangeChip() {
  const [index, setIndex] = useState(2);

  return (
    <button
      type="button"
      onClick={() => setIndex((i) => (i + 1) % RANGES.length)}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm font-medium text-foreground transition-colors hover:border-ring/50"
    >
      <CalendarDays className="size-3.5 text-muted-foreground" />
      {RANGES[index]}
    </button>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format-price';
import { buildPlpHref, type PlpParams } from '@/lib/plp-query';

/** A single-handle "Max Price" slider, matching the theme reference's own
 *  `ProductListing.tsx` Filters (a slider, not a min/max number-input pair —
 *  that was this app's own earlier, more-capable-but-differently-styled
 *  version). The bound is a plain hardcoded per-currency constant, not
 *  derived from a real "highest price in this catalog" aggregation — same
 *  "reasonable fixed default, not fabricated precision" posture as this
 *  app's existing free-shipping-threshold constant, and the theme's own
 *  slider is exactly as hardcoded (₹25,000). Reaching the top of the slider
 *  clears the maxPrice filter entirely (an open-ended "and above"), same
 *  as the theme's own "₹25,000+" label. */
const SLIDER_MAX_BY_CURRENCY: Record<string, { max: number; step: number }> = {
  INR: { max: 25_000, step: 500 },
  USD: { max: 2_000, step: 50 },
};
const DEFAULT_BOUND = { max: 2_000, step: 50 };

export function PriceRangeSlider({
  basePath,
  params,
  currency = 'USD',
}: {
  basePath: string;
  params: PlpParams;
  currency?: string;
}) {
  const router = useRouter();
  const { max: sliderMax, step } = SLIDER_MAX_BY_CURRENCY[currency.toUpperCase()] ?? DEFAULT_BOUND;
  const initial = params.maxPrice ? Math.min(sliderMax, Number(params.maxPrice)) : sliderMax;
  const [value, setValue] = useState(initial);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(next: number) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(buildPlpHref(basePath, params, { maxPrice: next >= sliderMax ? undefined : String(next) }));
    }, 400);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-widest text-jet uppercase">Max Price</h3>
        <span className="text-xs font-semibold text-champagne">
          {value >= sliderMax ? `${formatPrice(sliderMax, currency)}+` : formatPrice(value, currency)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Maximum price"
        className="w-full accent-champagne"
      />
      <div className="mt-1 flex justify-between text-xs text-slate">
        <span>{formatPrice(0, currency)}</span>
        <span>{formatPrice(sliderMax, currency)}+</span>
      </div>
    </div>
  );
}

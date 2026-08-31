'use client';

import { useMemo, useState } from 'react';
import { TruckIcon, ArrowUturnLeftIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { ProductActions } from './product-actions';
import { formatPrice } from '@/lib/format-price';
import { TaxInclusiveNote } from '@/components/tax-inclusive-note';
import { colorSwatchHex, isColorAxis } from '@/lib/color-swatches';
import type { ProductVariant } from '@/types/product';

interface VariantAxis {
  attributeCode: string;
  attributeLabel: string;
  options: string[];
}

const TRUST_BADGES = [
  { Icon: TruckIcon, label: 'Free shipping', sub: 'over $50' },
  { Icon: ArrowUturnLeftIcon, label: '30-day returns', sub: 'no questions' },
  { Icon: CheckBadgeIcon, label: '100% authentic', sub: 'guaranteed' },
];

/** Derives the distinct axis attributes (Size, Color, ...) and their option values from every
 * variant's axisValues — a SIMPLE/DIGITAL/VIRTUAL product's single variant has none, so this
 * returns an empty list and the picker UI simply doesn't render. */
function buildAxes(variants: ProductVariant[]): VariantAxis[] {
  const byCode = new Map<string, { attributeLabel: string; options: Set<string> }>();
  for (const variant of variants) {
    for (const axisValue of variant.axisValues) {
      const entry = byCode.get(axisValue.attributeCode) ?? { attributeLabel: axisValue.attributeLabel, options: new Set<string>() };
      entry.options.add(axisValue.optionLabel);
      byCode.set(axisValue.attributeCode, entry);
    }
  }
  return [...byCode.entries()].map(([attributeCode, { attributeLabel, options }]) => ({
    attributeCode,
    attributeLabel,
    options: [...options],
  }));
}

function selectionOf(variant: ProductVariant | undefined, axes: VariantAxis[]): Record<string, string> {
  const selection: Record<string, string> = {};
  if (!variant) return selection;
  for (const axis of axes) {
    const match = variant.axisValues.find((a) => a.attributeCode === axis.attributeCode);
    if (match) selection[axis.attributeCode] = match.optionLabel;
  }
  return selection;
}

/** Price, stock status, the Size/Color axis picker (for a configurable product), and the
 * Add to Cart/Buy Now actions — grouped into one client component because selecting a different
 * Size or Color needs to swap all three together to the matching variant's own price/stock.
 * `priceNumber`/`currency` are threaded down to ProductActions too, which owns the mobile
 * sticky add-to-bag bar (matching the reference theme) — that bar needs the live-selected
 * variant's price, and ProductActions already owns the qty/add-to-cart state it also needs. */
export function ProductPurchasePanel({
  productId,
  currency,
  variants,
  pricesIncludeTax,
}: {
  productId: string;
  currency: string;
  variants: ProductVariant[];
  pricesIncludeTax: boolean;
}) {
  const axes = useMemo(() => buildAxes(variants), [variants]);
  const [selection, setSelection] = useState<Record<string, string>>(() => selectionOf(variants[0], axes));

  const selectedVariant = useMemo(() => {
    if (axes.length === 0) return variants[0];
    return variants.find((variant) =>
      axes.every((axis) => variant.axisValues.find((a) => a.attributeCode === axis.attributeCode)?.optionLabel === selection[axis.attributeCode]),
    );
  }, [variants, axes, selection]);

  const priceNumber = selectedVariant?.price ? Number(selectedVariant.price) : null;
  const mrpNumber = selectedVariant?.mrp ? Number(selectedVariant.mrp) : null;
  const hasSavings = priceNumber !== null && mrpNumber !== null && mrpNumber > priceNumber;
  const savings = hasSavings ? mrpNumber! - priceNumber! : 0;
  const inStock = selectedVariant?.inStock ?? false;

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-bold text-jet">
          {priceNumber !== null ? formatPrice(priceNumber, currency) : 'Price unavailable'}
        </span>
        {hasSavings ? (
          <>
            <span className="text-lg text-slate line-through">{formatPrice(mrpNumber!, currency)}</span>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-semibold text-green-700">
              You save {formatPrice(savings, currency)}
            </span>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-slate">
        {pricesIncludeTax ? (
          <>
            Inclusive of all taxes <TaxInclusiveNote /> · Free returns within 30 days
          </>
        ) : (
          'Free returns within 30 days'
        )}
      </p>
      <p className={`mt-2 text-sm font-medium ${selectedVariant ? (inStock ? 'text-green-700' : 'text-destructive') : 'text-slate'}`}>
        {selectedVariant ? (inStock ? 'In Stock' : 'Out of Stock') : 'Select options to see availability'}
      </p>

      {axes.length > 0 ? (
        <div className="mt-4 space-y-4 border-t border-ghost pt-4">
          {axes.map((axis) =>
            isColorAxis(axis.attributeCode, axis.attributeLabel) ? (
              <div key={axis.attributeCode}>
                <p className="mb-2 text-xs font-semibold tracking-widest text-jet uppercase">
                  {axis.attributeLabel} —{' '}
                  <span className="text-sm font-normal tracking-normal text-charcoal normal-case">
                    {selection[axis.attributeCode] ?? ''}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {axis.options.map((option) => {
                    const isSelected = selection[axis.attributeCode] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        title={option}
                        aria-pressed={isSelected}
                        onClick={() => setSelection((prev) => ({ ...prev, [axis.attributeCode]: option }))}
                        className={`size-8 rounded-full border-2 transition-all ${
                          isSelected ? 'scale-110 border-jet shadow-md' : 'border-transparent hover:border-silver'
                        }`}
                        style={{ backgroundColor: colorSwatchHex(option) }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div key={axis.attributeCode}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-widest text-jet uppercase">{axis.attributeLabel}</p>
                  {/* Presentational only, matching the reference theme's own non-functional
                      "Size guide" link — this store has no real size-chart content to link to. */}
                  {axis.attributeLabel.toLowerCase() === 'size' ? (
                    <span className="text-xs font-medium text-champagne">Size guide</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {axis.options.map((option) => {
                    const isSelected = selection[axis.attributeCode] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelection((prev) => ({ ...prev, [axis.attributeCode]: option }))}
                        className={`min-w-11 rounded-xl border-2 px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          isSelected ? 'border-jet bg-jet text-white' : 'border-ghost text-charcoal hover:border-jet/40'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      ) : null}

      <div className="mt-6">
        <ProductActions productId={productId} variant={selectedVariant} inStock={inStock} price={priceNumber} currency={currency} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {TRUST_BADGES.map(({ Icon, label, sub }) => (
          <div key={label} className="rounded-xl bg-ivory p-3 text-center">
            <Icon className="mx-auto mb-1 size-5 text-champagne" />
            <p className="text-[11px] leading-tight font-semibold text-jet">{label}</p>
            <p className="mt-0.5 text-[10px] text-slate">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

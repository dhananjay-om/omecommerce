'use client';

import { useMemo, useState } from 'react';
import { ProductActions } from './product-actions';
import type { ProductVariant } from '@/types/product';

interface VariantAxis {
  attributeCode: string;
  attributeLabel: string;
  options: string[];
}

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
 * Size or Color needs to swap all three together to the matching variant's own price/stock. */
export function ProductPurchasePanel({
  productId,
  currency,
  variants,
}: {
  productId: string;
  currency: string;
  variants: ProductVariant[];
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
  const inStock = selectedVariant?.inStock ?? false;

  return (
    <div>
      <p className="text-3xl font-bold">{priceNumber !== null ? `${currency} ${priceNumber.toFixed(2)}` : 'Price unavailable'}</p>
      <p className={`mt-1 text-sm font-medium ${selectedVariant ? (inStock ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
        {selectedVariant ? (inStock ? 'In Stock' : 'Out of Stock') : 'Select options to see availability'}
      </p>

      {axes.length > 0 ? (
        <div className="mt-4 space-y-4">
          {axes.map((axis) => (
            <div key={axis.attributeCode}>
              <p className="text-sm font-medium">
                {axis.attributeLabel}
                {selection[axis.attributeCode] ? <span className="text-muted-foreground">: {selection[axis.attributeCode]}</span> : null}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {axis.options.map((option) => {
                  const isSelected = selection[axis.attributeCode] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelection((prev) => ({ ...prev, [axis.attributeCode]: option }))}
                      className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <ProductActions productId={productId} variant={selectedVariant} inStock={inStock} />
      </div>
    </div>
  );
}

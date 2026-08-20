import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { TaxCalculator, TaxLineInput, TaxLineResult, TaxContext } from '../domain/ports.js';
import type { TaxClassLookup, WebsiteTaxConfigLookup } from '../domain/repositories.js';
import { applyRate, extractTaxExclusive, toMinorUnits } from '../../../shared/domain/decimal.js';
import { splitGst } from '../domain/gst.js';

/** Resolves a variant -> product -> tax_class (plan/00 §9: native implementation). */
export class PrismaTaxClassLookup implements TaxClassLookup {
  constructor(private readonly db: Db) {}

  async byVariantId(variantId: bigint): Promise<{ code: string; rateMinor: bigint } | null> {
    const variant = await this.db.productVariant.findFirst({
      where: { id: variantId },
      select: { product: { select: { taxClassId: true } } },
    });
    if (!variant?.product.taxClassId) return null;
    const taxClass = await this.db.taxClass.findFirst({
      where: { id: variant.product.taxClassId, isActive: true },
      select: { code: true, rate: true },
    });
    if (!taxClass) return null;
    return { code: taxClass.code, rateMinor: toMinorUnits(taxClass.rate.toString()) };
  }
}

/** This selling Website's own GST registration (own-copy lookup, per-module convention). */
export class PrismaWebsiteTaxConfigLookup implements WebsiteTaxConfigLookup {
  constructor(private readonly db: Db) {}

  async byId(websiteId: bigint) {
    const row = await this.db.website.findFirst({
      where: { id: websiteId },
      select: { name: true, gstin: true, originStateCode: true, pricesIncludeTax: true, address: true, logoMediaKey: true, supportEmail: true },
    });
    if (!row) return null;
    return {
      name: row.name,
      gstin: row.gstin,
      originStateCode: row.originStateCode,
      pricesIncludeTax: row.pricesIncludeTax,
      address: row.address,
      logoMediaKey: row.logoMediaKey,
      supportEmail: row.supportEmail,
    };
  }
}

/**
 * India-GST-aware native tax calculator (plan/00 §9 decision: native + adapter
 * interface — a pluggable Avalara/TaxJar-style adapter is still future work,
 * the port boundary is unchanged). `TaxClass.rate` is the COMBINED GST rate
 * (e.g. 0.18 for 18%); this class derives the CGST/SGST-vs-IGST split at
 * calculation time via gst.ts's splitGst() — nothing about the split is
 * stored on TaxClass itself, so the same class works whether a given order
 * turns out intra- or inter-state.
 */
export class NativeGstTaxCalculator implements TaxCalculator {
  constructor(
    private readonly taxClasses: TaxClassLookup,
    private readonly websiteTaxConfig: WebsiteTaxConfigLookup,
  ) {}

  async calculate(lines: TaxLineInput[], context: TaxContext): Promise<TaxLineResult[]> {
    const origin = await this.websiteTaxConfig.byId(context.websiteId);
    const originStateCode = origin?.originStateCode ?? null;
    const pricesIncludeTax = origin?.pricesIncludeTax ?? false;

    const results: TaxLineResult[] = [];
    for (const line of lines) {
      const taxClass = await this.taxClasses.byVariantId(line.variantId);
      if (!taxClass) {
        results.push({
          variantId: line.variantId,
          taxClassCode: null,
          rateMinor: 0n,
          amountMinor: 0n,
          taxableAmountMinor: line.lineSubtotalMinor,
          breakdown: [],
        });
        continue;
      }
      // Exclusive (default): the input subtotal IS the taxable base, GST is
      // computed on top of it (unchanged from before this setting existed).
      // Inclusive: the input subtotal is actually a final, tax-inclusive
      // price — back GST out of it instead, so the caller's downstream
      // totals (which just add amountMinor on top of taxableAmountMinor)
      // land back on the same final price the catalog listed.
      let taxableAmountMinor: bigint;
      let amountMinor: bigint;
      if (pricesIncludeTax) {
        const extracted = extractTaxExclusive(line.lineSubtotalMinor, taxClass.rateMinor);
        taxableAmountMinor = extracted.exclusiveMinor;
        amountMinor = extracted.taxMinor;
      } else {
        taxableAmountMinor = line.lineSubtotalMinor;
        amountMinor = applyRate(line.lineSubtotalMinor, taxClass.rateMinor);
      }
      // plan/15 Phase 6 — a tax-exempt B2B buyer still gets tax correctly
      // backed OUT of a tax-inclusive price above (taxableAmountMinor is
      // computed identically either way, so they pay the ex-tax price, not
      // the same sticker price as retail); only the amount actually
      // collected is zeroed. splitGst() already no-ops on a zero amount, so
      // this naturally yields an empty breakdown -> zero OrderTaxLine rows.
      if (context.taxExempt) amountMinor = 0n;
      const breakdown = splitGst(taxClass.rateMinor, amountMinor, originStateCode, context.destinationStateCode);
      results.push({ variantId: line.variantId, taxClassCode: taxClass.code, rateMinor: taxClass.rateMinor, amountMinor, taxableAmountMinor, breakdown });
    }
    return results;
  }
}

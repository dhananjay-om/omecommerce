import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { TaxCalculator, TaxLineInput, TaxLineResult, TaxContext } from '../domain/ports.js';
import type { TaxClassLookup, WebsiteTaxConfigLookup } from '../domain/repositories.js';
import { applyRate, toMinorUnits } from '../../../shared/domain/decimal.js';
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

  async byId(websiteId: bigint): Promise<{ gstin: string | null; originStateCode: string | null } | null> {
    const row = await this.db.website.findFirst({ where: { id: websiteId }, select: { gstin: true, originStateCode: true } });
    return row ? { gstin: row.gstin, originStateCode: row.originStateCode } : null;
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

    const results: TaxLineResult[] = [];
    for (const line of lines) {
      const taxClass = await this.taxClasses.byVariantId(line.variantId);
      if (!taxClass) {
        results.push({ variantId: line.variantId, taxClassCode: null, rateMinor: 0n, amountMinor: 0n, breakdown: [] });
        continue;
      }
      const amountMinor = applyRate(line.lineSubtotalMinor, taxClass.rateMinor);
      const breakdown = splitGst(taxClass.rateMinor, amountMinor, originStateCode, context.destinationStateCode);
      results.push({ variantId: line.variantId, taxClassCode: taxClass.code, rateMinor: taxClass.rateMinor, amountMinor, breakdown });
    }
    return results;
  }
}

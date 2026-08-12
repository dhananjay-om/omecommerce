import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { TaxCalculator, TaxLineInput, TaxLineResult } from '../domain/ports.js';
import type { TaxClassLookup } from '../domain/repositories.js';
import { applyRate, toMinorUnits } from '../../../shared/domain/decimal.js';

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

/** Flat-rate native tax calculator (plan/00 §9 decision: native + adapter interface). */
export class NativeTaxCalculator implements TaxCalculator {
  constructor(private readonly taxClasses: TaxClassLookup) {}

  async calculate(lines: TaxLineInput[]): Promise<TaxLineResult[]> {
    const results: TaxLineResult[] = [];
    for (const line of lines) {
      const taxClass = await this.taxClasses.byVariantId(line.variantId);
      if (!taxClass) {
        results.push({ variantId: line.variantId, taxClassCode: null, rateMinor: 0n, amountMinor: 0n });
        continue;
      }
      const amountMinor = applyRate(line.lineSubtotalMinor, taxClass.rateMinor);
      results.push({ variantId: line.variantId, taxClassCode: taxClass.code, rateMinor: taxClass.rateMinor, amountMinor });
    }
    return results;
  }
}

import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { ShippingCalculator, ShippingQuote } from '../domain/ports.js';
import { toMinorUnits } from '../../../shared/domain/decimal.js';

/** Flat-rate native shipping (plan/00 §9 decision: native + adapter interface). */
export class NativeShippingCalculator implements ShippingCalculator {
  constructor(private readonly db: Db) {}

  async quote(methodCode: string, currency: string): Promise<ShippingQuote | null> {
    const method = await this.db.shippingMethod.findFirst({
      where: { code: methodCode, currency, isActive: true, deletedAt: null },
    });
    if (!method) return null;
    return { methodCode: method.code, amountMinor: toMinorUnits(method.flatRate.toString()) };
  }
}

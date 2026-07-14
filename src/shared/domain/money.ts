/**
 * Money value object (plan/00-master-plan.md §4.5).
 * Amounts are stored as strings/Decimal in the DB (NUMERIC(18,4)); in the domain we
 * keep integer minor units + an ISO-4217 currency to avoid float error.
 */
export class Money {
  private constructor(
    public readonly minorUnits: bigint,
    public readonly currency: string,
  ) {}

  static of(minorUnits: bigint | number, currency: string): Money {
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Invalid currency: ${currency}`);
    return new Money(BigInt(minorUnits), currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}

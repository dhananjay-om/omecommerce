import { DomainError } from '../../../shared/domain/errors.js';

/** Thrown when a guarded charge UPDATE affects 0 rows (would exceed the credit limit, the account is frozen, or lost a race). */
export class CreditLimitExceededError extends DomainError {
  constructor(requested: string) {
    super(`Charging ${requested} would exceed this company's credit limit`, 'https://errors.ome/credit-limit-exceeded', 409);
  }
}

export class CreditAccountFrozenError extends DomainError {
  constructor() {
    super('company credit account is frozen', 'https://errors.ome/credit-account-frozen', 409);
  }
}

/** A recorded payment can't exceed what's actually outstanding — same "guarded, not just validated" discipline as everything else in this ledger. */
export class PaymentExceedsOutstandingError extends DomainError {
  constructor(requested: string) {
    super(`Payment of ${requested} exceeds the account's outstanding balance`, 'https://errors.ome/payment-exceeds-outstanding', 409);
  }
}

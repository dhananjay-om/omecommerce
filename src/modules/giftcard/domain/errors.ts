import { DomainError } from '../../../shared/domain/errors.js';

/** Thrown when a guarded redeem UPDATE affects 0 rows (insufficient balance, not ACTIVE, or lost a race). */
export class InsufficientGiftCardBalanceError extends DomainError {
  constructor(requested: string) {
    super(`Insufficient gift card balance to redeem ${requested}`, 'https://errors.ome/insufficient-balance', 409);
  }
}

export class GiftCardNotActiveError extends DomainError {
  constructor(status: string) {
    super(`gift card is not active (status: ${status})`, 'https://errors.ome/gift-card-not-active', 409);
  }
}

export class GiftCardExpiredError extends DomainError {
  constructor() {
    super('gift card has expired', 'https://errors.ome/gift-card-expired', 409);
  }
}

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

/** Thrown when a guarded hold-placement UPDATE affects 0 rows (insufficient available balance, not ACTIVE, or lost a race). */
export class InsufficientAvailableGiftCardBalanceError extends DomainError {
  constructor(requested: string) {
    super(`Insufficient available gift card balance to hold ${requested}`, 'https://errors.ome/insufficient-balance', 409);
  }
}

/** Thrown when capturing/releasing a stored-value hold that isn't (or is no longer) HELD. */
export class InvalidGiftCardHoldStateError extends DomainError {
  constructor(message: string) {
    super(message, 'https://errors.ome/invalid-hold-state', 409);
  }
}

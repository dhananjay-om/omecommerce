import { DomainError } from '../../../shared/domain/errors.js';

/** Thrown when a guarded debit UPDATE affects 0 rows (insufficient balance, frozen, or lost a race). */
export class InsufficientBalanceError extends DomainError {
  constructor(requested: string) {
    super(`Insufficient wallet balance to debit ${requested}`, 'https://errors.ome/insufficient-balance', 409);
  }
}

export class WalletFrozenError extends DomainError {
  constructor() {
    super('wallet is frozen', 'https://errors.ome/wallet-frozen', 409);
  }
}

/** Thrown when a guarded hold-placement UPDATE affects 0 rows (insufficient available balance, frozen, or lost a race). */
export class InsufficientAvailableBalanceError extends DomainError {
  constructor(requested: string) {
    super(`Insufficient available wallet balance to hold ${requested}`, 'https://errors.ome/insufficient-balance', 409);
  }
}

/** Thrown when capturing/releasing a stored-value hold that isn't (or is no longer) HELD. */
export class InvalidWalletHoldStateError extends DomainError {
  constructor(message: string) {
    super(message, 'https://errors.ome/invalid-hold-state', 409);
  }
}

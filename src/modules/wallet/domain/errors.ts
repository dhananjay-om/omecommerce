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

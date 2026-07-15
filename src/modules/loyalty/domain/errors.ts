import { DomainError } from '../../../shared/domain/errors.js';

/** Thrown when a guarded redeem/reverse UPDATE affects 0 rows (insufficient balance, not ACTIVE, or lost a race). */
export class InsufficientPointsError extends DomainError {
  constructor(requested: bigint) {
    super(`Insufficient points balance to redeem ${requested}`, 'https://errors.ome/insufficient-points', 409);
  }
}

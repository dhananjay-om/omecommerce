import { DomainError } from '../../../shared/domain/errors.js';

/** Thrown when a guarded reservation UPDATE affects 0 rows (not enough available stock). */
export class InsufficientStockError extends DomainError {
  constructor(requested: number, available?: number) {
    super(
      `Insufficient available stock: requested ${requested}${available !== undefined ? `, available ${available}` : ''}`,
      'https://errors.ome/insufficient-stock',
      409,
    );
  }
}

/** Thrown when a reservation state transition guard affects 0 rows (already terminal / raced). */
export class InvalidReservationStateError extends DomainError {
  constructor(message: string) {
    super(message, 'https://errors.ome/invalid-reservation-state', 409);
  }
}

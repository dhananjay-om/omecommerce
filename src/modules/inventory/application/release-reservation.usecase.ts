import type { StockLedger } from '../domain/repositories.js';

export class ReleaseReservation {
  constructor(private readonly ledger: StockLedger) {}

  async execute(reservationPublicId: string): Promise<void> {
    await this.ledger.releaseReservation(reservationPublicId);
  }
}

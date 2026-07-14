import type { StockLedger } from '../domain/repositories.js';

export class CommitReservation {
  constructor(private readonly ledger: StockLedger) {}

  async execute(reservationPublicId: string): Promise<void> {
    await this.ledger.commitReservation(reservationPublicId);
  }
}

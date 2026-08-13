import type { CurrencyRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';

export class DeleteCurrency {
  constructor(private readonly currencies: CurrencyRepository) {}

  async execute(code: string): Promise<void> {
    const existing = await this.currencies.findByCode(code);
    if (!existing) throw new NotFoundError('Currency', code);
    // Repository translates an in-use FK violation into a clean ConflictError.
    await this.currencies.delete(code);
  }
}

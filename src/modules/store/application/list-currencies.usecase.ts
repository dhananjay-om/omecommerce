import type { CurrencyRepository } from '../domain/repositories.js';
import type { CurrencyView } from './dto.js';

export class ListCurrencies {
  constructor(private readonly currencies: CurrencyRepository) {}

  async execute(): Promise<CurrencyView[]> {
    const rows = await this.currencies.list();
    return rows.map((c) => ({ code: c.code, symbol: c.symbol, name: c.name, minorUnits: c.minorUnits }));
  }
}

import type { CurrencyRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UpdateCurrencyCommand, CurrencyView } from './dto.js';

export class UpdateCurrency {
  constructor(private readonly currencies: CurrencyRepository) {}

  async execute(cmd: UpdateCurrencyCommand): Promise<CurrencyView> {
    const existing = await this.currencies.findByCode(cmd.code);
    if (!existing) throw new NotFoundError('Currency', cmd.code);

    const c = await this.currencies.update(cmd.code, {
      symbol: cmd.symbol,
      name: cmd.name,
      minorUnits: cmd.minorUnits,
    });
    return { code: c.code, symbol: c.symbol, name: c.name, minorUnits: c.minorUnits };
  }
}

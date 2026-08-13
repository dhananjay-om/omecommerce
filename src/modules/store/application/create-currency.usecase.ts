import type { CurrencyRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';
import type { CreateCurrencyCommand, CurrencyView } from './dto.js';

export class CreateCurrency {
  constructor(private readonly currencies: CurrencyRepository) {}

  async execute(cmd: CreateCurrencyCommand): Promise<CurrencyView> {
    const code = cmd.code.trim().toUpperCase();
    if (await this.currencies.findByCode(code)) {
      throw new ConflictError(`currency code already exists: ${code}`);
    }
    const c = await this.currencies.create({
      code,
      symbol: cmd.symbol,
      name: cmd.name,
      minorUnits: cmd.minorUnits,
    });
    return { code: c.code, symbol: c.symbol, name: c.name, minorUnits: c.minorUnits };
  }
}

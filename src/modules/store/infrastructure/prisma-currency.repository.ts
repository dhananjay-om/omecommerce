import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CurrencyRepository, CurrencyInfo, CreateCurrencyInput, UpdateCurrencyInput } from '../domain/repositories.js';

export class PrismaCurrencyRepository implements CurrencyRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCurrencyInput): Promise<CurrencyInfo> {
    const row = await this.db.currency.create({
      data: {
        code: input.code,
        symbol: input.symbol,
        name: input.name,
        minorUnits: input.minorUnits ?? 2,
      },
    });
    return row;
  }

  async findByCode(code: string): Promise<CurrencyInfo | null> {
    return this.db.currency.findUnique({ where: { code } });
  }

  async list(): Promise<CurrencyInfo[]> {
    return this.db.currency.findMany({ orderBy: { code: 'asc' } });
  }

  async update(code: string, input: UpdateCurrencyInput): Promise<CurrencyInfo> {
    const row = await this.db.currency.update({
      where: { code },
      data: {
        symbol: input.symbol,
        name: input.name,
        minorUnits: input.minorUnits,
      },
    });
    return row;
  }
}

import { Prisma } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CurrencyRepository, CurrencyInfo, CreateCurrencyInput, UpdateCurrencyInput } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';

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
    const data = { symbol: input.symbol, name: input.name, minorUnits: input.minorUnits, isDefault: input.isDefault };

    if (input.isDefault) {
      // uq_one_default_currency (partial unique index) rejects a second true row outright, so the
      // prior default has to be unset in the same transaction as setting this one.
      const [, row] = await this.db.$transaction([
        this.db.currency.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
        this.db.currency.update({ where: { code }, data }),
      ]);
      return row;
    }

    return this.db.currency.update({ where: { code }, data });
  }

  async delete(code: string): Promise<void> {
    try {
      await this.db.currency.delete({ where: { code } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictError(
          `currency ${code} is still in use (e.g. a website's base currency, or referenced by price lists, orders, carts, wallets, or gift cards) and can't be deleted`,
        );
      }
      throw err;
    }
  }
}

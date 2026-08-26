import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import { NotFoundError, ConflictError } from '../../../shared/domain/errors.js';
import { Prisma } from '@prisma/client';
import type {
  PincodeRepository,
  PincodeInfo,
  CreatePincodeInput,
  UpdatePincodeInput,
  ListPincodesFilter,
  PincodeListResult,
} from '../domain/repositories.js';

function toInfo(row: {
  publicId: string;
  code: string;
  city: string;
  state: string;
  estimatedDays: number;
  codAvailable: boolean;
  isActive: boolean;
  updatedAt: Date;
}): PincodeInfo {
  return {
    publicId: row.publicId,
    code: row.code,
    city: row.city,
    state: row.state,
    estimatedDays: row.estimatedDays,
    codAvailable: row.codAvailable,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPincodeRepository implements PincodeRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreatePincodeInput): Promise<PincodeInfo> {
    try {
      const row = await this.db.serviceablePincode.create({ data: input });
      return toInfo(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`pincode already exists: ${input.code}`);
      }
      throw err;
    }
  }

  async findByCode(code: string): Promise<PincodeInfo | null> {
    const row = await this.db.serviceablePincode.findUnique({ where: { code } });
    return row ? toInfo(row) : null;
  }

  async list(filter: ListPincodesFilter): Promise<PincodeListResult> {
    const where: Prisma.ServiceablePincodeWhereInput = {
      state: filter.state,
      ...(filter.search ? { OR: [{ code: { contains: filter.search, mode: 'insensitive' } }, { city: { contains: filter.search, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await this.db.$transaction([
      this.db.serviceablePincode.count({ where }),
      this.db.serviceablePincode.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { total, page: filter.page, pageSize: filter.pageSize, pincodes: rows.map(toInfo) };
  }

  async update(code: string, input: UpdatePincodeInput): Promise<PincodeInfo> {
    try {
      const row = await this.db.serviceablePincode.update({ where: { code }, data: input });
      return toInfo(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundError('pincode', code);
      }
      throw err;
    }
  }

  /** Sequential upserts, not queued — an admin-curated list (dozens to a
   *  few thousand rows), not a national 19k-row import; see this module's
   *  own plan doc for why that scale doesn't need BullMQ. */
  async bulkUpsert(inputs: CreatePincodeInput[]): Promise<{ created: number; updated: number }> {
    if (inputs.length === 0) return { created: 0, updated: 0 };
    const existing = await this.db.serviceablePincode.findMany({
      where: { code: { in: inputs.map((i) => i.code) } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((r) => r.code));

    for (const input of inputs) {
      await this.db.serviceablePincode.upsert({
        where: { code: input.code },
        create: input,
        update: input,
      });
    }

    const updated = inputs.filter((i) => existingCodes.has(i.code)).length;
    return { created: inputs.length - updated, updated };
  }
}

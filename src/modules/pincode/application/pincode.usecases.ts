import type { PincodeRepository } from '../domain/repositories.js';
import type {
  PincodeView,
  PincodeListView,
  CreatePincodeCommand,
  UpdatePincodeCommand,
  ListPincodesQuery,
  BulkUpsertPincodesCommand,
  BulkUpsertPincodesResult,
  PincodeCheckResult,
} from './dto.js';

const DEFAULT_PAGE_SIZE = 20;

function toView(info: { publicId: string; code: string; city: string; state: string; estimatedDays: number; codAvailable: boolean; isActive: boolean; updatedAt: Date }): PincodeView {
  return {
    publicId: info.publicId,
    code: info.code,
    city: info.city,
    state: info.state,
    estimatedDays: info.estimatedDays,
    codAvailable: info.codAvailable,
    isActive: info.isActive,
    updatedAt: info.updatedAt.toISOString(),
  };
}

export class CreatePincode {
  constructor(private readonly pincodes: PincodeRepository) {}
  async execute(cmd: CreatePincodeCommand): Promise<PincodeView> {
    return toView(await this.pincodes.create({ ...cmd, codAvailable: cmd.codAvailable ?? true }));
  }
}

export class ListPincodes {
  constructor(private readonly pincodes: PincodeRepository) {}
  async execute(query: ListPincodesQuery): Promise<PincodeListView> {
    const result = await this.pincodes.list({
      search: query.search,
      state: query.state,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    });
    return { total: result.total, page: result.page, pageSize: result.pageSize, pincodes: result.pincodes.map(toView) };
  }
}

export class UpdatePincode {
  constructor(private readonly pincodes: PincodeRepository) {}
  async execute(code: string, cmd: UpdatePincodeCommand): Promise<PincodeView> {
    return toView(await this.pincodes.update(code, cmd));
  }
}

export class BulkUpsertPincodes {
  constructor(private readonly pincodes: PincodeRepository) {}
  async execute(cmd: BulkUpsertPincodesCommand): Promise<BulkUpsertPincodesResult> {
    const rows = cmd.rows.map((r) => ({ ...r, codAvailable: r.codAvailable ?? true }));
    const { created, updated } = await this.pincodes.bulkUpsert(rows);
    return { total: rows.length, created, updated };
  }
}

/** The one PUBLIC, unauthenticated read this module exposes — everything
 *  else here is admin-only. Never leaks whether a pincode exists but is
 *  merely inactive vs. never having been added at all — both read as
 *  `{serviceable: false}` to a storefront visitor, same "not serviceable
 *  yet" honesty regardless of the internal reason. */
export class CheckPincode {
  constructor(private readonly pincodes: PincodeRepository) {}
  async execute(code: string): Promise<PincodeCheckResult> {
    const found = await this.pincodes.findByCode(code);
    if (!found || !found.isActive) return { serviceable: false };
    return { serviceable: true, city: found.city, state: found.state, estimatedDays: found.estimatedDays, codAvailable: found.codAvailable };
  }
}

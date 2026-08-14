import type { TaxClassRepository, TaxClassAdminInfo, ShippingMethodRepository } from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';

export class CreateTaxClass {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(cmd: { code: string; name: string; rate: string }): Promise<TaxClassAdminInfo> {
    if (await this.taxClasses.findByCode(cmd.code)) throw new ConflictError(`tax class code already exists: ${cmd.code}`);
    return this.taxClasses.create(cmd);
  }
}

export class ListTaxClasses {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(): Promise<TaxClassAdminInfo[]> {
    return this.taxClasses.list();
  }
}

export class UpdateTaxClass {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(code: string, cmd: { name?: string; rate?: string; isActive?: boolean }): Promise<TaxClassAdminInfo> {
    if (!(await this.taxClasses.findByCode(code))) throw new NotFoundError('TaxClass', code);
    return this.taxClasses.update(code, cmd);
  }
}

/** Soft-delete only — a deleted class simply stops resolving in TaxClassLookup;
 *  any order that already used it keeps its snapshotted taxClassCode/rate
 *  unaffected (order data is never re-derived from the live TaxClass row). */
export class DeleteTaxClass {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(code: string): Promise<void> {
    if (!(await this.taxClasses.findByCode(code))) throw new NotFoundError('TaxClass', code);
    await this.taxClasses.softDelete(code);
  }
}

export class CreateShippingMethod {
  constructor(private readonly shippingMethods: ShippingMethodRepository) {}

  async execute(cmd: { code: string; name: string; flatRate: string; currency: string }): Promise<{ publicId: string; code: string }> {
    if (await this.shippingMethods.findByCode(cmd.code)) {
      throw new ConflictError(`shipping method code already exists: ${cmd.code}`);
    }
    return this.shippingMethods.create(cmd);
  }
}

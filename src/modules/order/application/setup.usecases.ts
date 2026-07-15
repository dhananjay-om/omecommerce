import type { TaxClassRepository, ShippingMethodRepository } from '../domain/repositories.js';
import { ConflictError } from '../../../shared/domain/errors.js';

export class CreateTaxClass {
  constructor(private readonly taxClasses: TaxClassRepository) {}

  async execute(cmd: { code: string; name: string; rate: string }): Promise<{ publicId: string; code: string }> {
    if (await this.taxClasses.findByCode(cmd.code)) throw new ConflictError(`tax class code already exists: ${cmd.code}`);
    return this.taxClasses.create(cmd);
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

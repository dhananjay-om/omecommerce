import type {
  TaxClassRepository,
  TaxClassAdminInfo,
  ShippingMethodRepository,
  ShippingMethodAdminInfo,
  PaymentMethodRepository,
  PaymentMethodAdminInfo,
  PaymentMethodInfo,
} from '../domain/repositories.js';
import type { PaymentMethodType } from '@prisma/client';
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

export class ListShippingMethodsAdmin {
  constructor(private readonly shippingMethods: ShippingMethodRepository) {}

  async execute(): Promise<ShippingMethodAdminInfo[]> {
    return this.shippingMethods.listAll();
  }
}

export class UpdateShippingMethod {
  constructor(private readonly shippingMethods: ShippingMethodRepository) {}

  async execute(
    code: string,
    cmd: { name?: string; flatRate?: string; isActive?: boolean },
  ): Promise<ShippingMethodAdminInfo> {
    if (!(await this.shippingMethods.findByCode(code))) throw new NotFoundError('ShippingMethod', code);
    return this.shippingMethods.update(code, cmd);
  }
}

/** Soft-delete only — a deleted method simply stops being offered at checkout; any order that
 *  already used it keeps its own snapshotted shippingMethodCode/amount unaffected. */
export class DeleteShippingMethod {
  constructor(private readonly shippingMethods: ShippingMethodRepository) {}

  async execute(code: string): Promise<void> {
    if (!(await this.shippingMethods.findByCode(code))) throw new NotFoundError('ShippingMethod', code);
    await this.shippingMethods.softDelete(code);
  }
}

export class CreatePaymentMethod {
  constructor(private readonly paymentMethods: PaymentMethodRepository) {}

  async execute(cmd: { code: string; name: string; type: PaymentMethodType }): Promise<{ publicId: string; code: string }> {
    if (await this.paymentMethods.findByCode(cmd.code)) {
      throw new ConflictError(`payment method code already exists: ${cmd.code}`);
    }
    return this.paymentMethods.create(cmd);
  }
}

/** Storefront checkout — active methods only, in admin-chosen order. */
export class ListPaymentMethods {
  constructor(private readonly paymentMethods: PaymentMethodRepository) {}

  async execute(): Promise<PaymentMethodInfo[]> {
    return this.paymentMethods.list();
  }
}

export class ListPaymentMethodsAdmin {
  constructor(private readonly paymentMethods: PaymentMethodRepository) {}

  async execute(): Promise<PaymentMethodAdminInfo[]> {
    return this.paymentMethods.listAll();
  }
}

export class UpdatePaymentMethod {
  constructor(private readonly paymentMethods: PaymentMethodRepository) {}

  async execute(code: string, cmd: { name?: string; isActive?: boolean }): Promise<PaymentMethodAdminInfo> {
    if (!(await this.paymentMethods.findByCode(code))) throw new NotFoundError('PaymentMethod', code);
    return this.paymentMethods.update(code, cmd);
  }
}

/** Soft-delete only — a deleted method simply stops being offered at checkout; any order that
 *  already used it keeps its own snapshotted paymentMethod code unaffected. */
export class DeletePaymentMethod {
  constructor(private readonly paymentMethods: PaymentMethodRepository) {}

  async execute(code: string): Promise<void> {
    if (!(await this.paymentMethods.findByCode(code))) throw new NotFoundError('PaymentMethod', code);
    await this.paymentMethods.softDelete(code);
  }
}

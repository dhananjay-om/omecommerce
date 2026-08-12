import type { ShippingMethodRepository } from '../domain/repositories.js';
import type { ShippingMethodViewDto } from './dto.js';

/** Storefront checkout needs real options to show, not a blind code (plan/14 Phase 7a). */
export class ListShippingMethods {
  constructor(private readonly shippingMethods: ShippingMethodRepository) {}

  execute(currency: string): Promise<ShippingMethodViewDto[]> {
    return this.shippingMethods.list(currency);
  }
}

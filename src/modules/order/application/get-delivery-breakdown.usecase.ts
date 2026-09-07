import type { OrderRepository } from '../domain/repositories.js';
import type { DeliveryBreakdownDto } from './dto.js';

/** Delivery's summary stat row — a plain count breakdown over the same
 *  Fulfillment/ShipmentTracking data Shipments already surfaces. */
export class GetDeliveryBreakdown {
  constructor(private readonly orders: OrderRepository) {}

  async execute(): Promise<DeliveryBreakdownDto> {
    return this.orders.getDeliveryBreakdown();
  }
}

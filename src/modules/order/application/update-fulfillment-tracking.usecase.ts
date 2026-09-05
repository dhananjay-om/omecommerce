import type { OrderRepository } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import type { UpdateFulfillmentTrackingCommand } from './dto.js';

/** The missing "fix a mistake after the fact" path — FulfillOrder is the
 *  only OTHER place tracking fields get written, and it's one-shot at
 *  fulfillment-creation time. Every field is optional; only what's
 *  provided overwrites (blank/omitted means "leave unchanged"). Records
 *  one order-history line (`TRACKING_UPDATED`) so the change shows up on
 *  that order's own timeline, same as every other order mutation. */
export class UpdateShipmentTracking {
  constructor(private readonly orders: OrderRepository) {}

  async execute(cmd: UpdateFulfillmentTrackingCommand): Promise<void> {
    const fulfillment = await this.orders.findFulfillmentByPublicId(cmd.fulfillmentPublicId);
    if (!fulfillment) throw new NotFoundError('Fulfillment', cmd.fulfillmentPublicId);

    await this.orders.updateFulfillmentTracking(fulfillment.id, {
      carrier: cmd.carrier,
      trackingNumber: cmd.trackingNumber,
      carrierTrackingUrl: cmd.carrierTrackingUrl,
      estimatedDeliveryAt: cmd.estimatedDeliveryAt ? new Date(cmd.estimatedDeliveryAt) : undefined,
      shippingNotes: cmd.shippingNotes,
    });

    await this.orders.recordHistory({
      orderId: fulfillment.orderId,
      eventType: 'TRACKING_UPDATED',
      message: cmd.trackingNumber ? `Tracking updated (tracking: ${cmd.trackingNumber})` : 'Tracking details updated',
      actorType: 'ADMIN',
    });
  }
}

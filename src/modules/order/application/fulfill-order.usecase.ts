import type { OrderRepository, WarehouseResolver } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { InvalidOrderStateError } from '../domain/errors.js';
import type { FulfillOrderCommand, OrderViewDto } from './dto.js';
import { toOrderDto } from './get-order.usecase.js';

export class FulfillOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly warehouses: WarehouseResolver,
  ) {}

  async execute(cmd: FulfillOrderCommand): Promise<OrderViewDto> {
    const order = await this.orders.findByPublicId(cmd.orderPublicId);
    if (!order) throw new NotFoundError('Order', cmd.orderPublicId);
    if (order.financialStatus !== 'PAID') {
      throw new InvalidOrderStateError(`order ${cmd.orderPublicId} is not paid — cannot fulfill`);
    }

    const warehouse = await this.warehouses.resolveForStore(order.storeId);
    if (!warehouse) throw new NotFoundError('Warehouse', 'no warehouse available for this order');

    const fulfillmentLines: Array<{ orderLineId: bigint; qty: number }> = [];
    for (const requested of cmd.lines) {
      const line = order.lines.find((l) => l.sku === requested.sku);
      if (!line) throw new NotFoundError('OrderLine', requested.sku);
      await this.orders.incrementFulfilledQty(line.id, requested.qty);
      fulfillmentLines.push({ orderLineId: line.id, qty: requested.qty });
    }

    await this.orders.createFulfillment({
      orderId: order.id,
      warehouseId: warehouse.id,
      status: 'SHIPPED',
      lines: fulfillmentLines,
    });

    const updated = await this.orders.findByPublicId(cmd.orderPublicId);
    const allFulfilled = updated!.lines.every((l) => l.fulfilledQty >= l.qty);
    const anyFulfilled = updated!.lines.some((l) => l.fulfilledQty > 0);
    await this.orders.setFulfillmentStatus(order.id, allFulfilled ? 'FULFILLED' : anyFulfilled ? 'PARTIALLY_FULFILLED' : 'UNFULFILLED');

    const final = await this.orders.findByPublicId(cmd.orderPublicId);
    return toOrderDto(final!);
  }
}

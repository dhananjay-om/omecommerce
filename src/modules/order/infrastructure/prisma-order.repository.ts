import type { PaymentTxnType, PaymentTxnStatus, ShipmentStatus, FinancialStatus, OrderStatus, FulfillmentStatus } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { OrderRepository, CreateOrderInput, OrderView } from '../domain/repositories.js';
import { fromMinorUnits, toMinorUnits } from '../../../shared/domain/decimal.js';
import { OutboxWriter } from '../../../shared/infrastructure/outbox/outbox-writer.js';
import { FulfillmentExceedsQtyError, RefundExceedsQtyError } from '../domain/errors.js';

/**
 * Prisma's Decimal (decimal.js) normalizes trailing zeros on toString()
 * ("100.0000" -> "100"), same issue fixed with a raw ::text cast in the pricing
 * resolver. Here the reads go through the normal Prisma ORM (not $queryRaw), so
 * we instead round-trip through the fixed-point helpers to force a consistent
 * NUMERIC(18,4)-scale string.
 */
function formatDecimal(value: { toString(): string }): string {
  return fromMinorUnits(toMinorUnits(value.toString()));
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: Db) {}

  async nextOrderNumber(websiteId: bigint): Promise<bigint> {
    const rows = await this.db.$queryRaw<Array<{ n: bigint }>>`SELECT next_order_number(${websiteId}) AS n`;
    return rows[0]!.n;
  }

  async create(input: CreateOrderInput, orderNumber: bigint): Promise<OrderView> {
    const row = await this.db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          websiteId: input.websiteId,
          storeId: input.storeId,
          storeViewId: input.storeViewId,
          cartId: input.cartId,
          customerGroupId: input.customerGroupId,
          email: input.email,
          currency: input.currency,
          subtotal: fromMinorUnits(input.subtotalMinor),
          taxTotal: fromMinorUnits(input.taxTotalMinor),
          shippingTotal: fromMinorUnits(input.shippingTotalMinor),
          grandTotal: fromMinorUnits(input.grandTotalMinor),
          shippingMethodCode: input.shippingMethodCode,
        },
      });
      const lines = await Promise.all(
        input.lines.map((l) =>
          tx.orderLine.create({
            data: {
              orderId: order.id,
              variantId: l.variantId,
              sku: l.sku,
              name: l.name,
              qty: l.qty,
              unitPrice: fromMinorUnits(l.unitPriceMinor),
              taxAmount: fromMinorUnits(l.taxAmountMinor),
              rowTotal: fromMinorUnits(l.rowTotalMinor),
              taxClassCode: l.taxClassCode,
            },
          }),
        ),
      );
      await tx.orderAddress.createMany({
        data: input.addresses.map((a) => ({ orderId: order.id, ...a })),
      });
      if (input.taxLines.length > 0) {
        await tx.orderTaxLine.createMany({
          data: input.taxLines.map((t) => ({
            orderId: order.id,
            taxClassCode: t.taxClassCode,
            rate: fromMinorUnits(t.rateMinor),
            amount: fromMinorUnits(t.amountMinor),
          })),
        });
      }
      // Same-transaction outbox write (true atomicity) — order creation and its
      // OrderPlaced event either both commit or both roll back together.
      await new OutboxWriter(tx).write({
        aggregateType: 'Order',
        aggregateId: order.publicId,
        eventType: 'OrderPlaced',
        payload: { orderNumber: order.orderNumber.toString(), email: order.email, grandTotal: fromMinorUnits(input.grandTotalMinor) },
      });
      return { order, lines };
    });

    return toView(row.order, row.lines);
  }

  async findByPublicId(publicId: string): Promise<OrderView | null> {
    const order = await this.db.order.findFirst({ where: { publicId }, include: { lines: true } });
    return order ? toView(order, order.lines) : null;
  }

  async setFinancialStatus(orderId: bigint, status: FinancialStatus): Promise<void> {
    await this.db.order.update({ where: { id: orderId }, data: { financialStatus: status } });
  }

  async setOrderStatus(orderId: bigint, status: OrderStatus): Promise<void> {
    await this.db.order.update({ where: { id: orderId }, data: { status } });
  }

  async setFulfillmentStatus(orderId: bigint, status: FulfillmentStatus): Promise<void> {
    await this.db.order.update({ where: { id: orderId }, data: { fulfillmentStatus: status } });
  }

  async recordPayment(input: {
    orderId: bigint;
    method: string;
    gateway: string;
    type: PaymentTxnType;
    amountMinor: bigint;
    currency: string;
    status: PaymentTxnStatus;
    gatewayRef: string | null;
    raw?: unknown;
  }): Promise<void> {
    await this.db.paymentTransaction.create({
      data: {
        orderId: input.orderId,
        method: input.method,
        gateway: input.gateway,
        type: input.type,
        amount: fromMinorUnits(input.amountMinor),
        currency: input.currency,
        status: input.status,
        gatewayRef: input.gatewayRef,
        raw: input.raw === undefined ? undefined : (input.raw as object),
      },
    });
  }

  async incrementFulfilledQty(orderLineId: bigint, qty: number): Promise<void> {
    // Guarded UPDATE mirroring the order_line_fulfilled_qty_bounds /
    // order_line_qty_conservation CHECKs — gives a clean 409 instead of a raw
    // constraint-violation exception bubbling up.
    const affected = await this.db.$executeRaw`
      UPDATE order_line SET fulfilled_qty = fulfilled_qty + ${qty}, version = version + 1
       WHERE id = ${orderLineId} AND fulfilled_qty + ${qty} <= qty`;
    if (affected === 0) throw new FulfillmentExceedsQtyError(orderLineId);
  }

  async incrementRefundedQty(orderLineId: bigint, qty: number): Promise<void> {
    const affected = await this.db.$executeRaw`
      UPDATE order_line SET refunded_qty = refunded_qty + ${qty}, version = version + 1
       WHERE id = ${orderLineId} AND refunded_qty + ${qty} <= qty`;
    if (affected === 0) throw new RefundExceedsQtyError(orderLineId);
  }

  async createFulfillment(input: {
    orderId: bigint;
    warehouseId: bigint;
    status: ShipmentStatus;
    lines: Array<{ orderLineId: bigint; qty: number }>;
  }): Promise<{ id: bigint; publicId: string }> {
    return this.db.$transaction(async (tx) => {
      const fulfillment = await tx.fulfillment.create({
        data: {
          orderId: input.orderId,
          warehouseId: input.warehouseId,
          status: input.status,
          shippedAt: input.status === 'SHIPPED' ? new Date() : null,
        },
      });
      await tx.fulfillmentLine.createMany({
        data: input.lines.map((l) => ({ fulfillmentId: fulfillment.id, orderLineId: l.orderLineId, qty: l.qty })),
      });
      return { id: fulfillment.id, publicId: fulfillment.publicId };
    });
  }
}

interface OrderRow {
  id: bigint;
  publicId: string;
  orderNumber: bigint;
  websiteId: bigint;
  storeId: bigint;
  email: string;
  currency: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  subtotal: { toString(): string };
  taxTotal: { toString(): string };
  shippingTotal: { toString(): string };
  grandTotal: { toString(): string };
}

interface OrderLineRow {
  id: bigint;
  variantId: bigint;
  sku: string;
  name: string;
  qty: number;
  unitPrice: { toString(): string };
  taxAmount: { toString(): string };
  rowTotal: { toString(): string };
  fulfilledQty: number;
  refundedQty: number;
  version: number;
}

function toView(order: OrderRow, lines: OrderLineRow[]): OrderView {
  return {
    id: order.id,
    publicId: order.publicId,
    orderNumber: order.orderNumber.toString(),
    websiteId: order.websiteId,
    storeId: order.storeId,
    email: order.email,
    currency: order.currency,
    status: order.status,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotal: formatDecimal(order.subtotal),
    taxTotal: formatDecimal(order.taxTotal),
    shippingTotal: formatDecimal(order.shippingTotal),
    grandTotal: formatDecimal(order.grandTotal),
    lines: lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      unitPrice: formatDecimal(l.unitPrice),
      taxAmount: formatDecimal(l.taxAmount),
      rowTotal: formatDecimal(l.rowTotal),
      fulfilledQty: l.fulfilledQty,
      refundedQty: l.refundedQty,
      version: l.version,
    })),
  };
}

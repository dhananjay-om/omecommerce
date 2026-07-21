import { Prisma } from '@prisma/client';
import type { PaymentTxnType, PaymentTxnStatus, ShipmentStatus, FinancialStatus, OrderStatus, FulfillmentStatus } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  OrderRepository,
  CreateOrderInput,
  OrderView,
  ListOrdersFilter,
  OrderListResult,
  OrderAddressView,
  RecordOrderHistoryInput,
  OrderHistoryView,
  AddOrderNoteInput,
  OrderNoteView,
} from '../domain/repositories.js';
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

/** include clause shared by every full-detail order read (findByPublicId, and create()'s post-write re-fetch). */
const ORDER_DETAIL_INCLUDE = {
  lines: true,
  addresses: true,
  payments: { orderBy: { createdAt: 'asc' as const } },
  fulfillments: { include: { lines: true }, orderBy: { createdAt: 'asc' as const } },
  returns: { include: { lines: true }, orderBy: { createdAt: 'asc' as const } },
  notes: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.OrderInclude;

type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: Db) {}

  async nextOrderNumber(websiteId: bigint): Promise<bigint> {
    const rows = await this.db.$queryRaw<Array<{ n: bigint }>>`SELECT next_order_number(${websiteId}) AS n`;
    return rows[0]!.n;
  }

  async create(input: CreateOrderInput, orderNumber: bigint): Promise<OrderView> {
    const orderId = await this.db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          websiteId: input.websiteId,
          storeId: input.storeId,
          storeViewId: input.storeViewId,
          cartId: input.cartId,
          customerId: input.customerId,
          customerGroupId: input.customerGroupId,
          email: input.email,
          currency: input.currency,
          customerIp: input.customerIp ?? null,
          subtotal: fromMinorUnits(input.subtotalMinor),
          taxTotal: fromMinorUnits(input.taxTotalMinor),
          shippingTotal: fromMinorUnits(input.shippingTotalMinor),
          grandTotal: fromMinorUnits(input.grandTotalMinor),
          shippingMethodCode: input.shippingMethodCode,
        },
      });
      await Promise.all(
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
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, eventType: 'ORDER_CREATED', message: 'Order placed', actorType: 'SYSTEM' },
      });
      return order.id;
    });

    const detail = await this.db.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    return toView(detail);
  }

  async findByPublicId(publicId: string): Promise<OrderView | null> {
    const order = await this.db.order.findFirst({ where: { publicId }, include: ORDER_DETAIL_INCLUDE });
    return order ? toView(order) : null;
  }

  async list(filter: ListOrdersFilter): Promise<OrderListResult> {
    const conditions: Prisma.Sql[] = [];
    if (filter.status) conditions.push(Prisma.sql`o.status = ${filter.status}::"OrderStatus"`);
    if (filter.financialStatus) conditions.push(Prisma.sql`o.financial_status = ${filter.financialStatus}::"FinancialStatus"`);
    if (filter.fulfillmentStatus) conditions.push(Prisma.sql`o.fulfillment_status = ${filter.fulfillmentStatus}::"FulfillmentStatus"`);
    if (filter.email) conditions.push(Prisma.sql`o.email ILIKE ${`%${filter.email}%`}`);
    if (filter.customerName) conditions.push(Prisma.sql`ba.name ILIKE ${`%${filter.customerName}%`}`);
    if (filter.dateFrom) conditions.push(Prisma.sql`o.created_at >= ${filter.dateFrom}`);
    if (filter.dateTo) conditions.push(Prisma.sql`o.created_at <= ${filter.dateTo}`);
    if (filter.orderId) {
      const asNumber = /^\d+$/.test(filter.orderId) ? BigInt(filter.orderId) : null;
      conditions.push(
        asNumber !== null
          ? Prisma.sql`(o.public_id::text = ${filter.orderId} OR o.order_number = ${asNumber})`
          : Prisma.sql`o.public_id::text = ${filter.orderId}`,
      );
    }
    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const sortColumn =
      filter.sortBy === 'grandTotal' ? Prisma.sql`o.grand_total` : filter.sortBy === 'customerName' ? Prisma.sql`ba.name` : Prisma.sql`o.created_at`;
    const sortDir = filter.sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const fromJoin = Prisma.sql`
      FROM "order" o
      LEFT JOIN order_address ba ON ba.order_id = o.id AND ba.type = 'BILLING'
      LEFT JOIN LATERAL (
        SELECT method FROM payment_transaction p WHERE p.order_id = o.id ORDER BY p.created_at ASC LIMIT 1
      ) pt ON true
      ${where}`;

    const [countRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`SELECT COUNT(*)::bigint AS n ${fromJoin}`),
      this.db.$queryRaw<
        Array<{
          public_id: string;
          order_number: bigint;
          email: string;
          customer_name: string | null;
          payment_method: string | null;
          currency: string;
          status: string;
          financial_status: string;
          fulfillment_status: string;
          grand_total: string;
          created_at: Date;
        }>
      >(Prisma.sql`
        SELECT o.public_id, o.order_number, o.email, COALESCE(ba.name, o.email) AS customer_name, pt.method AS payment_method,
               o.currency, o.status, o.financial_status, o.fulfillment_status, o.grand_total::text AS grand_total, o.created_at
        ${fromJoin}
        ORDER BY ${sortColumn} ${sortDir}
        LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}`),
    ]);

    return {
      total: Number(countRows[0]?.n ?? 0n),
      page: filter.page,
      pageSize: filter.pageSize,
      orders: rows.map((row) => ({
        publicId: row.public_id,
        orderNumber: row.order_number.toString(),
        email: row.email,
        customerName: row.customer_name ?? row.email,
        paymentMethod: row.payment_method,
        currency: row.currency,
        status: row.status,
        financialStatus: row.financial_status,
        fulfillmentStatus: row.fulfillment_status,
        grandTotal: formatDecimal(row.grand_total),
        createdAt: row.created_at,
      })),
    };
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

  async setClosedAt(orderId: bigint, closedAt: Date): Promise<void> {
    await this.db.order.update({ where: { id: orderId }, data: { closedAt, status: 'CLOSED' } });
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
    trackingNumber?: string | null;
    carrier?: string | null;
    lines: Array<{ orderLineId: bigint; qty: number }>;
  }): Promise<{ id: bigint; publicId: string }> {
    return this.db.$transaction(async (tx) => {
      const fulfillment = await tx.fulfillment.create({
        data: {
          orderId: input.orderId,
          warehouseId: input.warehouseId,
          status: input.status,
          trackingNumber: input.trackingNumber ?? null,
          carrier: input.carrier ?? null,
          shippedAt: input.status === 'SHIPPED' ? new Date() : null,
        },
      });
      await tx.fulfillmentLine.createMany({
        data: input.lines.map((l) => ({ fulfillmentId: fulfillment.id, orderLineId: l.orderLineId, qty: l.qty })),
      });
      return { id: fulfillment.id, publicId: fulfillment.publicId };
    });
  }

  async recordHistory(input: RecordOrderHistoryInput): Promise<void> {
    await this.db.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        eventType: input.eventType,
        fromValue: input.fromValue ?? null,
        toValue: input.toValue ?? null,
        message: input.message ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
      },
    });
  }

  async listHistory(orderId: bigint): Promise<OrderHistoryView[]> {
    const rows = await this.db.orderStatusHistory.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      fromValue: r.fromValue,
      toValue: r.toValue,
      message: r.message,
      actorType: r.actorType,
      actorName: r.actorName,
      createdAt: r.createdAt,
    }));
  }

  async addNote(input: AddOrderNoteInput): Promise<OrderNoteView> {
    const row = await this.db.orderNote.create({
      data: { orderId: input.orderId, type: input.type, body: input.body, createdBy: input.createdBy ?? null },
    });
    return { id: row.id, type: row.type, body: row.body, createdAt: row.createdAt };
  }
}

function toAddressView(a: { type: string; name: string; company: string | null; line1: string; line2: string | null; city: string; region: string | null; postalCode: string; country: string; phone: string | null }): OrderAddressView {
  return {
    type: a.type as OrderAddressView['type'],
    name: a.name,
    company: a.company,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    country: a.country,
    phone: a.phone,
  };
}

function toView(order: OrderDetailRow): OrderView {
  return {
    id: order.id,
    publicId: order.publicId,
    orderNumber: order.orderNumber.toString(),
    websiteId: order.websiteId,
    storeId: order.storeId,
    customerId: order.customerId,
    email: order.email,
    currency: order.currency,
    status: order.status,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotal: formatDecimal(order.subtotal),
    discountTotal: formatDecimal(order.discountTotal),
    taxTotal: formatDecimal(order.taxTotal),
    shippingTotal: formatDecimal(order.shippingTotal),
    grandTotal: formatDecimal(order.grandTotal),
    shippingMethodCode: order.shippingMethodCode,
    customerIp: order.customerIp,
    placedAt: order.placedAt,
    closedAt: order.closedAt,
    lines: order.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      unitPrice: formatDecimal(l.unitPrice),
      taxAmount: formatDecimal(l.taxAmount),
      discountAmount: formatDecimal(l.discountAmount),
      rowTotal: formatDecimal(l.rowTotal),
      fulfilledQty: l.fulfilledQty,
      refundedQty: l.refundedQty,
      version: l.version,
    })),
    addresses: order.addresses.map(toAddressView),
    payments: order.payments.map((p) => ({
      id: p.id,
      method: p.method,
      gateway: p.gateway,
      type: p.type,
      amount: formatDecimal(p.amount),
      currency: p.currency,
      status: p.status,
      gatewayRef: p.gatewayRef,
      createdAt: p.createdAt,
    })),
    fulfillments: order.fulfillments.map((f) => ({
      publicId: f.publicId,
      status: f.status,
      trackingNumber: f.trackingNumber,
      carrier: f.carrier,
      shippedAt: f.shippedAt,
      createdAt: f.createdAt,
      lines: f.lines.map((l) => ({ orderLineId: l.orderLineId, qty: l.qty })),
    })),
    returns: order.returns.map((r) => ({
      publicId: r.publicId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      lines: r.lines.map((l) => ({ orderLineId: l.orderLineId, qty: l.qty, restock: l.restock })),
    })),
    notes: order.notes.map((n) => ({ id: n.id, type: n.type, body: n.body, createdAt: n.createdAt })),
  };
}

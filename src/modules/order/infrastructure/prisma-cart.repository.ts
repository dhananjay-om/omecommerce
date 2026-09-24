import type { TenderType } from '@prisma/client';
import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { CartRepository, CartView, CreateCartInput } from '../domain/repositories.js';
import { CartNotActiveError } from '../domain/errors.js';

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateCartInput): Promise<CartView> {
    const row = await this.db.cart.create({
      data: {
        websiteId: input.websiteId,
        storeViewId: input.storeViewId,
        currency: input.currency,
        customerId: input.customerId ?? null,
        customerGroupId: input.customerGroupId ?? null,
      },
      include: LINES_INCLUDE,
    });
    return toView(row);
  }

  async findByPublicId(publicId: string): Promise<CartView | null> {
    const row = await this.db.cart.findFirst({ where: { publicId }, include: LINES_INCLUDE });
    return row ? toView(row) : null;
  }

  async upsertLine(cartId: bigint, variantId: bigint, qty: number): Promise<void> {
    if (qty <= 0) {
      await this.db.cartLine.deleteMany({ where: { cartId, variantId } });
      return;
    }
    await this.db.cartLine.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      update: { qty },
      create: { cartId, variantId, qty },
    });
  }

  async claimForCheckout(cartId: bigint): Promise<void> {
    // Guarded ACTIVE -> CONVERTED transition, same pattern as inventory's guarded
    // reservation UPDATE — atomically prevents two concurrent checkout calls for
    // the same cart from both proceeding (plan/05 §2.3 cart trust model).
    const rows = await this.db.$executeRaw`
      UPDATE cart SET status = 'CONVERTED', updated_at = now() WHERE id = ${cartId} AND status = 'ACTIVE'`;
    if (rows === 0) {
      const cart = await this.db.cart.findFirst({ where: { id: cartId }, select: { publicId: true } });
      throw new CartNotActiveError(cart?.publicId ?? String(cartId));
    }
  }

  async reopenAfterFailedCheckout(cartId: bigint, opts?: { onlyIfOlderThanSeconds?: number }): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const carts = await tx.$queryRaw<Array<{ status: string; idle_seconds: number }>>`
        SELECT status::text AS status, EXTRACT(EPOCH FROM (now() - updated_at))::float8 AS idle_seconds
        FROM cart WHERE id = ${cartId} FOR UPDATE`;
      const cart = carts[0];
      if (!cart || cart.status !== 'CONVERTED') return false;
      if (opts?.onlyIfOlderThanSeconds !== undefined && cart.idle_seconds < opts.onlyIfOlderThanSeconds) return false;

      const orders = await tx.$queryRaw<Array<{ id: bigint; order_status: string; financial_status: string }>>`
        SELECT id, status::text AS order_status, financial_status::text AS financial_status
        FROM "order" WHERE cart_id = ${cartId} FOR UPDATE`;
      const order = orders[0];
      if (order) {
        const declined = order.order_status === 'CANCELLED' && order.financial_status === 'FAILED';
        const neverProgressed = order.order_status === 'PENDING' && order.financial_status === 'PENDING';
        if (!declined && !neverProgressed) return false; // paid / on account / COD in progress — never reopen
        if (neverProgressed) {
          await tx.$executeRaw`UPDATE "order" SET status = 'CANCELLED', financial_status = 'FAILED' WHERE id = ${order.id}`;
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              eventType: 'CHECKOUT_FAILED',
              fromValue: 'PENDING',
              toValue: 'CANCELLED',
              message: 'Checkout did not complete — order cancelled so the customer can retry with the same cart',
              actorType: 'SYSTEM',
            },
          });
        }
        await tx.$executeRaw`UPDATE "order" SET cart_id = NULL WHERE id = ${order.id}`;
      }
      await tx.$executeRaw`UPDATE cart SET status = 'ACTIVE', updated_at = now() WHERE id = ${cartId}`;
      return true;
    });
  }

  async setCouponCode(cartId: bigint, code: string | null): Promise<void> {
    await this.db.cart.update({ where: { id: cartId }, data: { couponCode: code } });
  }

  async addTender(cartId: bigint, tenderType: TenderType, giftCardId: bigint | null): Promise<void> {
    // upsert (not create) so re-applying an already-applied tender is a no-op
    // instead of hitting the NULLS NOT DISTINCT unique violation directly —
    // Prisma's compound-unique upsert `where` needs a real (non-null) value
    // for every key column, so a WALLET tender (giftCardId always null) is
    // upserted by (cartId, tenderType) via a plain findFirst+create instead,
    // matching Wallet ledger's own upsert-loses-the-race fallback shape.
    if (giftCardId === null) {
      const existing = await this.db.cartTender.findFirst({ where: { cartId, tenderType, giftCardId: null } });
      if (existing) return;
      await this.db.cartTender.create({ data: { cartId, tenderType, giftCardId: null } });
      return;
    }
    await this.db.cartTender.upsert({
      where: { cartId_tenderType_giftCardId: { cartId, tenderType, giftCardId } },
      update: {},
      create: { cartId, tenderType, giftCardId },
    });
  }

  async removeTender(cartId: bigint, tenderType: TenderType, giftCardId: bigint | null): Promise<void> {
    await this.db.cartTender.deleteMany({ where: { cartId, tenderType, giftCardId } });
  }

  async attachCustomer(cartId: bigint, customerId: bigint, customerGroupId: bigint | null): Promise<void> {
    await this.db.cart.update({ where: { id: cartId }, data: { customerId, customerGroupId } });
  }
}

/** Joins the variant's publicId alongside the internal FK — checkout needs the internal id, the storefront cart response needs the public one (plan/14 Phase 0d). */
const LINES_INCLUDE = {
  lines: { include: { variant: { select: { publicId: true } } } },
  tenders: { select: { tenderType: true, giftCardId: true, createdAt: true } },
} as const;

interface CartRow {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  storeViewId: bigint;
  currency: string;
  customerId: bigint | null;
  customerGroupId: bigint | null;
  status: CartView['status'];
  couponCode: string | null;
  lines: Array<{ id: bigint; variantId: bigint; qty: number; variant: { publicId: string } }>;
  tenders: Array<{ tenderType: TenderType; giftCardId: bigint | null; createdAt: Date }>;
}

function toView(row: CartRow): CartView {
  return {
    id: row.id,
    publicId: row.publicId,
    websiteId: row.websiteId,
    storeViewId: row.storeViewId,
    currency: row.currency,
    customerId: row.customerId,
    customerGroupId: row.customerGroupId,
    status: row.status,
    couponCode: row.couponCode,
    lines: row.lines.map((l) => ({ id: l.id, variantId: l.variantId, variantPublicId: l.variant.publicId, qty: l.qty })),
    tenders: row.tenders.map((t) => ({ tenderType: t.tenderType, giftCardId: t.giftCardId, createdAt: t.createdAt })),
  };
}

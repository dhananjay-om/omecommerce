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
      UPDATE cart SET status = 'CONVERTED' WHERE id = ${cartId} AND status = 'ACTIVE'`;
    if (rows === 0) {
      const cart = await this.db.cart.findFirst({ where: { id: cartId }, select: { publicId: true } });
      throw new CartNotActiveError(cart?.publicId ?? String(cartId));
    }
  }
}

/** Joins the variant's publicId alongside the internal FK — checkout needs the internal id, the storefront cart response needs the public one (plan/14 Phase 0d). */
const LINES_INCLUDE = { lines: { include: { variant: { select: { publicId: true } } } } } as const;

interface CartRow {
  id: bigint;
  publicId: string;
  websiteId: bigint;
  storeViewId: bigint;
  currency: string;
  customerId: bigint | null;
  customerGroupId: bigint | null;
  status: CartView['status'];
  lines: Array<{ id: bigint; variantId: bigint; qty: number; variant: { publicId: string } }>;
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
    lines: row.lines.map((l) => ({ id: l.id, variantId: l.variantId, variantPublicId: l.variant.publicId, qty: l.qty })),
  };
}

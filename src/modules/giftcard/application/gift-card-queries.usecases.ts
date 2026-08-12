import type { GiftCardLedger } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { hashGiftCardCode } from '../infrastructure/code.js';
import type { GiftCardView, GiftCardTransactionView } from './dto.js';

function toView(c: { publicId: string; codeLast4: string; initialAmount: string; balance: string; currency: string; status: GiftCardView['status']; kind: GiftCardView['kind']; expiresAt: Date | null }): GiftCardView {
  return {
    publicId: c.publicId,
    codeLast4: c.codeLast4,
    initialAmount: c.initialAmount,
    balance: c.balance,
    currency: c.currency,
    status: c.status,
    kind: c.kind,
    expiresAt: c.expiresAt?.toISOString() ?? null,
  };
}

export class GetGiftCard {
  constructor(private readonly giftCards: GiftCardLedger) {}

  async execute(publicId: string): Promise<GiftCardView> {
    const card = await this.giftCards.findByPublicId(publicId);
    if (!card) throw new NotFoundError('gift card', publicId);
    return toView(card);
  }
}

/** Storefront balance check by raw code (plan/10 §7: rate-limiting deferred, no rate-limit infra exists yet). */
export class GetGiftCardByCode {
  constructor(
    private readonly giftCards: GiftCardLedger,
    private readonly hmacSecret: string,
  ) {}

  async execute(code: string): Promise<GiftCardView> {
    const card = await this.giftCards.findByCodeHash(hashGiftCardCode(code, this.hmacSecret));
    if (!card) throw new NotFoundError('gift card', 'code');
    return toView(card);
  }
}

export class ListGiftCardTransactions {
  constructor(private readonly giftCards: GiftCardLedger) {}

  async execute(publicId: string): Promise<GiftCardTransactionView[]> {
    const card = await this.giftCards.findByPublicId(publicId);
    if (!card) throw new NotFoundError('gift card', publicId);
    const rows = await this.giftCards.listTransactions(card.id);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }
}

export class DisableGiftCard {
  constructor(private readonly giftCards: GiftCardLedger) {}

  async execute(publicId: string): Promise<void> {
    const card = await this.giftCards.findByPublicId(publicId);
    if (!card) throw new NotFoundError('gift card', publicId);
    await this.giftCards.disable(card.id);
  }
}

export class AdjustGiftCard {
  constructor(private readonly giftCards: GiftCardLedger) {}

  async execute(publicId: string, amount: string, reason: string, actorId?: bigint): Promise<GiftCardView> {
    const card = await this.giftCards.findByPublicId(publicId);
    if (!card) throw new NotFoundError('gift card', publicId);
    const updated = await this.giftCards.adjust(card.id, amount, { actorId, reason });
    return toView(updated);
  }
}

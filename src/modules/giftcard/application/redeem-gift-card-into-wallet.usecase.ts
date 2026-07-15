import type { WalletLedger } from '../../wallet/domain/repositories.js';
import type { GiftCardLedger, CustomerLookup } from '../domain/repositories.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors.js';
import { GiftCardExpiredError, GiftCardNotActiveError } from '../domain/errors.js';
import { hashGiftCardCode } from '../infrastructure/code.js';
import type { RedeemGiftCardIntoWalletResult } from './dto.js';

/**
 * The self-contained "load into wallet" path (plan/10 §4.2) that doesn't need
 * checkout integration: redeems the gift card's FULL balance and credits the
 * customer's wallet, in the customer's own website/currency (which must match
 * the gift card's currency — cross-currency stored value isn't supported,
 * plan/10 §10). Reuses WalletLedger directly (correctness-critical ledger
 * logic, not duplicated) — same cross-module reuse pattern as Order reusing
 * Inventory's StockLedger/Pricing's PriceResolver.
 *
 * Two separate atomic operations (redeem, then credit), not one cross-table
 * transaction — same saga/compensation precedent as CompleteCheckout: if the
 * wallet credit fails after the gift card was debited, the gift card is
 * credited back (a compensating ADJUST), never silently lost.
 */
export class RedeemGiftCardIntoWallet {
  constructor(
    private readonly giftCards: GiftCardLedger,
    private readonly wallets: WalletLedger,
    private readonly customers: CustomerLookup,
    private readonly hmacSecret: string,
  ) {}

  async execute(customerPublicId: string, code: string): Promise<RedeemGiftCardIntoWalletResult> {
    const customerId = await this.customers.findIdByPublicId(customerPublicId);
    if (!customerId) {
      throw new NotFoundError('customer', customerPublicId);
    }
    const card = await this.giftCards.findByCodeHash(hashGiftCardCode(code, this.hmacSecret));
    if (!card) {
      throw new NotFoundError('gift card', 'code');
    }
    if (card.status !== 'ACTIVE') {
      throw new GiftCardNotActiveError(card.status);
    }
    if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
      throw new GiftCardExpiredError();
    }
    if (Number(card.balance) <= 0) {
      throw new ConflictError('gift card has no balance to redeem');
    }

    const amount = card.balance;
    await this.giftCards.redeem(card.id, amount, { refType: 'wallet_load', reason: `redeemed into wallet by customer ${customerPublicId}` });

    try {
      const wallet = await this.wallets.getOrCreateWallet(customerId, card.websiteId, card.currency);
      const walletSnapshot = await this.wallets.credit(wallet.id, amount, 'PREPAID_TOPUP', 'GIFTCARD_LOAD', {
        refType: 'gift_card',
        refId: card.id,
        reason: `gift card ...${card.codeLast4} redeemed into wallet`,
      });
      return { redeemedAmount: amount, walletBalance: walletSnapshot.balance };
    } catch (err) {
      // Compensate: credit the gift card back — same saga pattern as
      // checkout's reservation-release-on-payment-failure.
      await this.giftCards.adjust(card.id, amount, { reason: 'compensating reversal: wallet credit failed' });
      throw err;
    }
  }
}

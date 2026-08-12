import type { GiftCardLedger, WebsiteLookup } from '../domain/repositories.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
import { generateGiftCardCode, hashGiftCardCode, last4 } from '../infrastructure/code.js';
import type { IssueGiftCardCommand, IssuedGiftCardView } from './dto.js';

export class IssueGiftCard {
  constructor(
    private readonly giftCards: GiftCardLedger,
    private readonly websites: WebsiteLookup,
    private readonly hmacSecret: string,
  ) {}

  async execute(cmd: IssueGiftCardCommand, createdBy?: bigint): Promise<IssuedGiftCardView> {
    const website = await this.websites.byCode(cmd.websiteCode);
    if (!website) {
      throw new NotFoundError('website', cmd.websiteCode);
    }
    const code = generateGiftCardCode();
    const codeHash = hashGiftCardCode(code, this.hmacSecret);
    const card = await this.giftCards.issue({
      websiteId: website.id,
      codeHash,
      codeLast4: last4(code),
      initialAmount: cmd.amount,
      currency: website.baseCurrency,
      kind: cmd.kind ?? 'DIGITAL',
      source: 'ADMIN_ISSUED',
      recipientEmail: cmd.recipientEmail,
      recipientName: cmd.recipientName,
      message: cmd.message,
      expiresAt: cmd.expiresAt ? new Date(cmd.expiresAt) : null,
      createdBy,
    });
    return {
      publicId: card.publicId,
      code,
      codeLast4: card.codeLast4,
      initialAmount: card.initialAmount,
      balance: card.balance,
      currency: card.currency,
      status: card.status,
    };
  }
}

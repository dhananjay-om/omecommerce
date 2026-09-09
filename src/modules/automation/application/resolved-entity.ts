/** What EvaluateAutomationRules resolves a triggering event's aggregateId
 *  into before evaluating conditions/running actions — real fields read
 *  fresh from the actual entity (or, for STOCK_CHANGED, straight from the
 *  event's own payload — see evaluate-automation-rules.usecase.ts's doc
 *  comment on why that one case doesn't need a second lookup), never
 *  fabricated placeholders. */
export interface ResolvedEntity {
  type: 'Order' | 'StockItem' | 'Customer';
  publicId: string;
  fields: Record<string, string | number | null>;
  /** A real email to default an EMAIL action's recipient to when its
   *  config asks for 'CUSTOMER' (or leaves recipient blank) — the order's
   *  own email, or the registering customer's; null for StockItem (a
   *  variant has no natural recipient). */
  defaultRecipientEmail: string | null;
  /** Short, real, human-readable label for footers/webhook payloads. */
  label: string;
}

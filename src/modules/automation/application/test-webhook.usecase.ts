import { postWebhook, type WebhookResult } from './post-webhook.js';

/** The admin's "Send Test" button (in the Rule/Workflow form, next to a
 *  WEBHOOK action's URL field) — fires a synthetic sample payload at the
 *  URL right now, through the exact same postWebhook() a real rule match
 *  uses, so a passing test really proves the URL is reachable and
 *  responds 2xx. Deliberately writes no AutomationRuleRun row — this
 *  isn't a real rule evaluation (there may not even be a saved rule
 *  yet), just a connectivity check. */
export class TestWebhook {
  async execute(url: string): Promise<WebhookResult> {
    const payload = {
      entityType: 'Order',
      entityPublicId: 'test-00000000-0000-0000-0000-000000000000',
      label: 'Test event — this is a sample payload, not a real order',
      fields: { status: 'CONFIRMED', financialStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED', grandTotal: 99.99, currency: 'USD' },
      firedAt: new Date().toISOString(),
    };
    return postWebhook(url, payload);
  }
}

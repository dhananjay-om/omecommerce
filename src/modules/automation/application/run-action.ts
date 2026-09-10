import type { ActionSpec, ActionResult } from '../domain/repositories.js';
import type { ResolvedEntity } from './resolved-entity.js';
import type { EmailSender } from '../../order/domain/ports.js';
import type { AddOrderNote } from '../../order/application/add-order-note.usecase.js';
import type { NotifyAdmins } from '../../notification/application/notify-admins.usecase.js';
import { postWebhook } from './post-webhook.js';

export interface RunActionDeps {
  emailSender: EmailSender;
  addOrderNote: AddOrderNote;
  notifyAdmins: NotifyAdmins;
}

/** Executes one ActionSpec against a resolved entity — three real
 *  actions, each backed by something that already exists or a small,
 *  generic new primitive (the webhook call), never a fabricated one per
 *  example (see the plan's own "Decisions" section on what was
 *  deliberately trimmed). Never throws — every failure mode (a bad
 *  webhook URL, SMTP not configured, ORDER_NOTE on a non-order entity)
 *  comes back as a real, readable ActionResult instead, so one action
 *  failing on one rule never blocks the run from being recorded or other
 *  actions on the same rule from being attempted. */
export async function runAction(action: ActionSpec, entity: ResolvedEntity, deps: RunActionDeps): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'EMAIL':
        return await runEmailAction(action, entity, deps.emailSender);
      case 'WEBHOOK':
        return await runWebhookAction(action, entity);
      case 'ORDER_NOTE':
        return await runOrderNoteAction(action, entity, deps.addOrderNote);
      case 'NOTIFY_ADMINS':
        return await runNotifyAdminsAction(action, entity, deps.notifyAdmins);
      default:
        return { type: action.type, ok: false, error: `unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { type: action.type, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runEmailAction(action: ActionSpec, entity: ResolvedEntity, emailSender: EmailSender): Promise<ActionResult> {
  const configuredRecipient = action.config.recipient?.trim();
  const recipient = !configuredRecipient || configuredRecipient.toUpperCase() === 'CUSTOMER' ? entity.defaultRecipientEmail : configuredRecipient;
  if (!recipient) {
    return { type: 'EMAIL', ok: false, error: 'no recipient — this entity has no email of its own and none was configured' };
  }
  const subject = action.config.subject?.trim() || `Automation alert — ${entity.label}`;
  const body = action.config.body?.trim() || '';
  const html = `${escapeHtml(body)}<p style="color:#666;font-size:12px;margin-top:16px;">Triggered by ${escapeHtml(entity.label)}.</p>`;
  await emailSender.send({ to: recipient, subject, html });
  return { type: 'EMAIL', ok: true };
}

async function runWebhookAction(action: ActionSpec, entity: ResolvedEntity): Promise<ActionResult> {
  const url = action.config.url?.trim();
  if (!url) return { type: 'WEBHOOK', ok: false, error: 'no URL configured' };
  const payload = {
    entityType: entity.type,
    entityPublicId: entity.publicId,
    label: entity.label,
    fields: entity.fields,
    firedAt: new Date().toISOString(),
  };
  const result = await postWebhook(url, payload);
  return { type: 'WEBHOOK', ok: result.ok, error: result.error };
}

async function runOrderNoteAction(action: ActionSpec, entity: ResolvedEntity, addOrderNote: AddOrderNote): Promise<ActionResult> {
  if (entity.type !== 'Order') {
    return { type: 'ORDER_NOTE', ok: false, error: `not applicable — this rule fired for a ${entity.type}, not an Order` };
  }
  const body = action.config.note?.trim() || `Automation rule matched for ${entity.label}.`;
  // createdBy omitted -> AddOrderNote records this as a SYSTEM-actor note,
  // correctly not attributing it to whichever admin happens to be logged
  // in when the automation fires (it wasn't them).
  await addOrderNote.execute({ orderPublicId: entity.publicId, type: 'INTERNAL', body });
  return { type: 'ORDER_NOTE', ok: true };
}

/** Broadcasts a real admin-topbar bell notification to every active
 *  admin — the config's title/message are the same simple text-with-no-
 *  templating shape as the EMAIL action's own subject/body. `actionHref`
 *  links to the entity's real admin page when one exists (Order,
 *  Customer) — StockItem has no individually-addressable admin page, so
 *  it's omitted rather than pointing somewhere wrong. Left blank, the
 *  default message pulls in the entity's own real fields (an order's
 *  amount/status) rather than a bare "A rule matched" — useful on its
 *  own for the common case (e.g. a plain "notify on order placed" rule)
 *  without requiring the admin to write a custom message. */
async function runNotifyAdminsAction(action: ActionSpec, entity: ResolvedEntity, notifyAdmins: NotifyAdmins): Promise<ActionResult> {
  const title = action.config.title?.trim() || `Automation: ${entity.label}`;
  const message = action.config.message?.trim() || defaultNotifyMessage(entity);
  const actionHref = entity.type === 'Order' ? `/orders/${entity.publicId}` : entity.type === 'Customer' ? `/customers/${entity.publicId}` : null;
  await notifyAdmins.execute({ category: 'AUTOMATION', title, message, actionHref });
  return { type: 'NOTIFY_ADMINS', ok: true };
}

function defaultNotifyMessage(entity: ResolvedEntity): string {
  if (entity.type === 'Order') {
    const total = typeof entity.fields.grandTotal === 'number' ? entity.fields.grandTotal.toFixed(2) : null;
    const currency = typeof entity.fields.currency === 'string' ? entity.fields.currency : '';
    const status = typeof entity.fields.status === 'string' ? entity.fields.status : null;
    const amount = total ? ` — ${currency} ${total}` : '';
    const statusPart = status ? ` (${status})` : '';
    return `${entity.label}${amount}${statusPart}`;
  }
  return `A rule matched for ${entity.label}.`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

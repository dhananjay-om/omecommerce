import { NotFoundError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infrastructure/logger.js';
import type { EmailSender } from '../../order/domain/ports.js';
import type { NewsletterRepository, SubscriberInfo, NewsletterStatusValue, SubscriberCounts } from '../domain/repositories.js';

export interface SubscriberView {
  publicId: string;
  email: string;
  status: NewsletterStatusValue;
  source: string;
  websiteCode: string | null;
  subscribedAt: string;
  unsubscribedAt: string | null;
}

function toView(s: SubscriberInfo): SubscriberView {
  return {
    publicId: s.publicId,
    email: s.email,
    status: s.status,
    source: s.source,
    websiteCode: s.websiteCode,
    subscribedAt: s.subscribedAt.toISOString(),
    unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null,
  };
}

function welcomeEmail(siteUrl: string | undefined, token: string): { subject: string; html: string } {
  const unsubscribe = siteUrl ? `${siteUrl.replace(/\/$/, '')}/newsletter/unsubscribe?token=${encodeURIComponent(token)}` : null;
  return {
    subject: "You're subscribed",
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#222">
<h2 style="margin:0 0 12px">Thanks for subscribing!</h2>
<p>You'll now get new arrivals, style notes and the occasional exclusive offer straight to your inbox.</p>
${unsubscribe ? `<p style="font-size:12px;color:#777">Changed your mind? <a href="${unsubscribe}">Unsubscribe</a> any time.</p>` : ''}
</div>`,
  };
}

export class SubscribeToNewsletter {
  constructor(
    private readonly newsletter: NewsletterRepository,
    private readonly email: EmailSender,
    private readonly siteUrl: string | undefined,
  ) {}

  /** Idempotent and non-revealing: subscribing an address that's already on
   *  the list succeeds the same way, so the public form can't be used to
   *  probe who is subscribed. A welcome email goes out only when something
   *  actually changed (new address, or an unsubscribed one coming back), and
   *  a mail failure never fails the sign-up. */
  async execute(cmd: { email: string; source?: string; websiteCode?: string }): Promise<void> {
    const { outcome, subscriber } = await this.newsletter.subscribe({
      email: cmd.email,
      source: cmd.source ?? 'home',
      websiteCode: cmd.websiteCode ?? null,
    });
    if (outcome === 'ALREADY_SUBSCRIBED') return;
    try {
      const { subject, html } = welcomeEmail(this.siteUrl, subscriber.unsubscribeToken);
      await this.email.send({ to: subscriber.email, subject, html });
    } catch (err) {
      logger.warn({ err }, 'newsletter welcome email failed');
    }
  }
}

export class UnsubscribeFromNewsletter {
  constructor(private readonly newsletter: NewsletterRepository) {}
  async execute(token: string): Promise<void> {
    const sub = await this.newsletter.findByToken(token);
    if (!sub) throw new NotFoundError('newsletter subscription', 'token');
    if (sub.status === 'SUBSCRIBED') await this.newsletter.setStatus(sub.publicId, 'UNSUBSCRIBED');
  }
}

export class AddSubscriber {
  constructor(private readonly newsletter: NewsletterRepository) {}
  async execute(email: string): Promise<SubscriberView> {
    const { subscriber } = await this.newsletter.subscribe({ email, source: 'admin', websiteCode: null });
    return toView(subscriber);
  }
}

export class ListSubscribers {
  constructor(private readonly newsletter: NewsletterRepository) {}
  async execute(q: { search?: string; status?: NewsletterStatusValue; page?: number; pageSize?: number }): Promise<{
    total: number;
    page: number;
    pageSize: number;
    subscribers: SubscriberView[];
    counts: SubscriberCounts;
  }> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const [{ total, subscribers }, counts] = await Promise.all([
      this.newsletter.list({ search: q.search, status: q.status, page, pageSize }),
      this.newsletter.counts(),
    ]);
    return { total, page, pageSize, subscribers: subscribers.map(toView), counts };
  }
}

export class SetSubscriberStatus {
  constructor(private readonly newsletter: NewsletterRepository) {}
  async execute(publicId: string, status: NewsletterStatusValue): Promise<SubscriberView> {
    return toView(await this.newsletter.setStatus(publicId, status));
  }
}

export class DeleteSubscriber {
  constructor(private readonly newsletter: NewsletterRepository) {}
  async execute(publicId: string): Promise<void> {
    await this.newsletter.delete(publicId);
  }
}

const csvCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""');

export class ExportSubscribersCsv {
  constructor(private readonly newsletter: NewsletterRepository) {}
  async execute(filter: { search?: string; status?: NewsletterStatusValue }): Promise<string> {
    const rows = await this.newsletter.listAll(filter);
    const lines = ['email,status,source,website,subscribed_at,unsubscribed_at'];
    for (const s of rows) {
      lines.push(
        [s.email, s.status, s.source, s.websiteCode ?? '', s.subscribedAt.toISOString(), s.unsubscribedAt?.toISOString() ?? '']
          .map((c) => `"${csvCell(c)}"`)
          .join(','),
      );
    }
    return lines.join('\n') + '\n';
  }
}

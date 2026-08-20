import type { EmailSender } from '../domain/ports.js';
import { DomainError } from '../../../shared/domain/errors.js';
import type { SendTestEmailCommand } from './dto.js';

/**
 * Sends a real email through whatever EmailSender is currently active — the
 * saved EmailSettings row if one exists, else the SMTP_* env vars, else the
 * log-only simulated sender (see order.module.ts's DynamicEmailSender) — so
 * "Send Test Email" always proves the SAME path a real order confirmation
 * would actually take, not a separate one-off connection. Throws straight
 * through on failure (unlike SendOrderEmail, which swallows a send failure
 * into a logged FAILED status): a test email's entire purpose is telling the
 * admin THAT it failed and why, right in the UI.
 */
export class SendTestEmail {
  constructor(private readonly emailSender: EmailSender) {}

  async execute(cmd: SendTestEmailCommand): Promise<void> {
    try {
      await this.emailSender.send({
        to: cmd.to,
        subject: 'OMEcommerce SMTP test',
        html: '<p>This is a test email from your OMEcommerce store — SMTP is configured correctly.</p>',
      });
    } catch (err) {
      // A raw nodemailer/connection error isn't a DomainError, so the shared
      // errorHandler would otherwise flatten it into a generic "Internal
      // Server Error" with no message — exactly the one piece of information
      // this whole feature exists to surface (wrong host, bad credentials,
      // blocked port, ...). Re-thrown as a clean 502 with the real reason.
      const message = err instanceof Error ? err.message : 'failed to send test email';
      throw new DomainError(message, 'https://errors.ome/email-send-failed', 502);
    }
  }
}

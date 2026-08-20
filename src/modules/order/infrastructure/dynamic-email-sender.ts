import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type { EmailSender } from '../domain/ports.js';
import { SmtpEmailSender } from './smtp-email-sender.js';

/**
 * Re-checks the email_settings singleton row on EVERY send, rather than being
 * fixed at process-boot time like every other adapter in this codebase
 * (TestPaymentGateway, SimulatedEmailSender) — this is the whole point of the
 * admin "Email (SMTP)" settings page: saving new credentials there takes
 * effect on the very next email, with no redeploy/restart. The saved row
 * always wins over the SMTP_* env vars (envFallback) when both exist; the env
 * vars stay supported for a server-side-only setup (deploy/set-smtp-
 * credentials.sh) that never touches the admin UI at all.
 */
export class DynamicEmailSender implements EmailSender {
  constructor(
    private readonly db: Db,
    private readonly envFallback: EmailSender,
  ) {}

  async send(input: { to: string; subject: string; html: string }): Promise<{ providerRef: string }> {
    const settings = await this.db.emailSettings.findFirst();
    if (settings && settings.username && settings.password) {
      const sender = new SmtpEmailSender({
        host: settings.host,
        port: settings.port,
        user: settings.username,
        pass: settings.password,
        from: settings.fromEmail
          ? settings.fromName
            ? `${settings.fromName} <${settings.fromEmail}>`
            : settings.fromEmail
          : settings.username,
      });
      return sender.send(input);
    }
    return this.envFallback.send(input);
  }
}

import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailSender } from '../domain/ports.js';

/**
 * Real EmailSender adapter, wired behind the exact same port SimulatedEmailSender
 * implements — used whenever SMTP_USER/SMTP_PASS are configured (see
 * order.module.ts's createEmailSender). Defaults (SMTP_HOST/SMTP_PORT) point at
 * Gmail's own published SMTP settings, so a Google Workspace or plain Gmail
 * account only needs to supply the address + an App Password:
 * https://myaccount.google.com/apppasswords (Gmail rejects a normal account
 * password over SMTP once 2-Step Verification is on, which Google requires for
 * App Passwords to even be offered).
 */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: { host: string; port: number; user: string; pass: string; from: string }) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // 465 is SMTPS (implicit TLS); every other port (587 — Gmail's documented
      // default, 25) is STARTTLS, negotiated after a plaintext connect.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(input: { to: string; subject: string; html: string }): Promise<{ providerRef: string }> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return { providerRef: info.messageId };
  }
}

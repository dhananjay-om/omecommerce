import { randomUUID } from 'node:crypto';
import type { EmailSender } from '../domain/ports.js';
import { logger } from '../../../shared/infrastructure/logger.js';

/**
 * Default EmailSender adapter (plan/15 §1.2 decision) — same precedent as
 * TestPaymentGateway: logs + returns a fake provider ref rather than calling
 * a real provider, since no SMTP/API credentials are configured in this
 * environment. Swapping in a real provider (Resend/SES/SMTP) later is a
 * one-file adapter change behind the same EmailSender port.
 */
export class SimulatedEmailSender implements EmailSender {
  async send(input: { to: string; subject: string; html: string }): Promise<{ providerRef: string }> {
    const providerRef = `simulated_${randomUUID()}`;
    logger.info({ to: input.to, subject: input.subject, providerRef }, `[simulated] sending email "${input.subject}" to ${input.to}`);
    return { providerRef };
  }
}

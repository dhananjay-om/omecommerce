import type { NotificationRepository, ActiveAdminUsersLookup, NotificationCategory } from '../domain/repositories.js';

export interface NotifyAdminsCommand {
  category: NotificationCategory;
  title: string;
  message: string;
  actionHref?: string | null;
}

/**
 * Broadcasts one notification to every currently-active admin user — the
 * two real call sites wired up: (1) EvaluateAlertRules, on every real
 * AlertHistory fire (genuine out-of-box value, zero admin setup
 * required); (2) the Automation engine's NOTIFY_ADMINS action, so an
 * admin can wire ANY of the 8 existing rule triggers to also raise a
 * bell notification, entirely through the already-shipped Rules/
 * Workflows UI — deliberately the only way to get a custom notification
 * (e.g. "new order placed"); there's no second, hardcoded event-wiring
 * path for that.
 */
export class NotifyAdmins {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly activeAdminUsers: ActiveAdminUsersLookup,
  ) {}

  async execute(cmd: NotifyAdminsCommand): Promise<void> {
    const recipientIds = await this.activeAdminUsers.listIds();
    if (recipientIds.length === 0) return;
    await this.notifications.createMany(
      recipientIds.map((recipientId) => ({
        recipientId,
        category: cmd.category,
        title: cmd.title,
        message: cmd.message,
        actionHref: cmd.actionHref ?? null,
      })),
    );
  }
}

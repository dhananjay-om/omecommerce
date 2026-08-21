import type { Db } from '../../../shared/infrastructure/prisma/client.js';
import type {
  AlertRuleRepository,
  AlertRuleRecord,
  AlertHistoryRecord,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from '../domain/alert-rule.repository.js';

const RULE_SELECT = {
  publicId: true,
  metricCode: true,
  comparator: true,
  thresholdValue: true,
  windowDays: true,
  recipientEmails: true,
  isActive: true,
  updatedAt: true,
} as const;

function toRecord(r: {
  publicId: string;
  metricCode: string;
  comparator: string;
  thresholdValue: { toString(): string };
  windowDays: number;
  recipientEmails: string[];
  isActive: boolean;
  updatedAt: Date;
}): AlertRuleRecord {
  return { ...r, thresholdValue: r.thresholdValue.toString() };
}

export class PrismaAlertRuleRepository implements AlertRuleRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateAlertRuleInput): Promise<AlertRuleRecord> {
    const row = await this.db.alertRule.create({
      data: {
        metricCode: input.metricCode,
        comparator: input.comparator,
        thresholdValue: input.thresholdValue,
        windowDays: input.windowDays,
        recipientEmails: input.recipientEmails,
        isActive: input.isActive,
      },
      select: RULE_SELECT,
    });
    return toRecord(row);
  }

  async findByPublicId(publicId: string): Promise<AlertRuleRecord | null> {
    const row = await this.db.alertRule.findFirst({ where: { publicId, deletedAt: null }, select: RULE_SELECT });
    return row ? toRecord(row) : null;
  }

  async list(): Promise<AlertRuleRecord[]> {
    const rows = await this.db.alertRule.findMany({ where: { deletedAt: null }, select: RULE_SELECT, orderBy: { metricCode: 'asc' } });
    return rows.map(toRecord);
  }

  async update(publicId: string, input: UpdateAlertRuleInput): Promise<AlertRuleRecord> {
    const row = await this.db.alertRule.update({
      where: { publicId },
      data: {
        comparator: input.comparator,
        thresholdValue: input.thresholdValue,
        windowDays: input.windowDays,
        recipientEmails: input.recipientEmails,
        isActive: input.isActive,
      },
      select: RULE_SELECT,
    });
    return toRecord(row);
  }

  async softDelete(publicId: string): Promise<void> {
    await this.db.alertRule.update({ where: { publicId }, data: { deletedAt: new Date() } });
  }

  async listActiveForEvaluation(): Promise<Array<AlertRuleRecord & { id: bigint }>> {
    const rows = await this.db.alertRule.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, ...RULE_SELECT },
    });
    return rows.map((r) => ({ ...toRecord(r), id: r.id }));
  }

  async recordFired(alertRuleId: bigint, metricValue: string, thresholdValue: string, message: string): Promise<void> {
    await this.db.alertHistory.create({ data: { alertRuleId, metricValue, thresholdValue, message } });
  }

  async listHistory(alertRulePublicId: string, limit: number): Promise<AlertHistoryRecord[]> {
    const rows = await this.db.alertHistory.findMany({
      where: { alertRule: { publicId: alertRulePublicId } },
      select: { firedAt: true, metricValue: true, thresholdValue: true, message: true, notifiedAt: true },
      orderBy: { firedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({ ...r, metricValue: r.metricValue.toString(), thresholdValue: r.thresholdValue.toString() }));
  }
}

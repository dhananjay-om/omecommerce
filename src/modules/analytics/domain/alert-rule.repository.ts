export interface AlertRuleRecord {
  publicId: string;
  metricCode: string;
  comparator: string;
  thresholdValue: string;
  windowDays: number;
  recipientEmails: string[];
  isActive: boolean;
  updatedAt: Date;
}

export interface CreateAlertRuleInput {
  metricCode: string;
  comparator: string;
  thresholdValue: string;
  windowDays?: number;
  recipientEmails: string[];
  isActive?: boolean;
}

export interface UpdateAlertRuleInput {
  comparator?: string;
  thresholdValue?: string;
  windowDays?: number;
  recipientEmails?: string[];
  isActive?: boolean;
}

export interface AlertHistoryRecord {
  firedAt: Date;
  metricValue: string;
  thresholdValue: string;
  message: string;
  notifiedAt: Date | null;
}

export interface AlertRuleRepository {
  create(input: CreateAlertRuleInput): Promise<AlertRuleRecord>;
  findByPublicId(publicId: string): Promise<AlertRuleRecord | null>;
  /** Every active-or-not rule, not soft-deleted — the admin config list. */
  list(): Promise<AlertRuleRecord[]>;
  update(publicId: string, input: UpdateAlertRuleInput): Promise<AlertRuleRecord>;
  softDelete(publicId: string): Promise<void>;

  /** Every active rule, keyed internally by id — the alert-evaluator
   *  worker's own read path (bypasses publicId, since it never exposes
   *  rules over HTTP, only evaluates them). */
  listActiveForEvaluation(): Promise<Array<AlertRuleRecord & { id: bigint }>>;
  recordFired(alertRuleId: bigint, metricValue: string, thresholdValue: string, message: string): Promise<void>;
  listHistory(alertRulePublicId: string, limit: number): Promise<AlertHistoryRecord[]>;
}

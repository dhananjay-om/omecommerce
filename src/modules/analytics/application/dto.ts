export interface CreateAlertRuleCommand {
  metricCode: string;
  comparator: string;
  thresholdValue: string;
  windowDays?: number;
  recipientEmails: string[];
  isActive?: boolean;
}

export interface UpdateAlertRuleCommand {
  publicId: string;
  comparator?: string;
  thresholdValue?: string;
  windowDays?: number;
  recipientEmails?: string[];
  isActive?: boolean;
}

export interface AlertRuleView {
  publicId: string;
  metricCode: string;
  comparator: string;
  thresholdValue: string;
  windowDays: number;
  recipientEmails: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface AlertHistoryView {
  firedAt: string;
  metricValue: string;
  thresholdValue: string;
  message: string;
  notifiedAt: string | null;
}

/** Query params every analytics read endpoint shares — `dateFrom`/`dateTo`
 *  are "YYYY-MM-DD" strings (same convention as order/interface/http/
 *  schemas.ts's listOrdersQuerySchema), converted to dateKey ints at the
 *  usecase boundary so the query repository never sees a raw Date. */
export interface AnalyticsDateRangeQuery {
  dateFrom: string;
  dateTo: string;
  websiteId?: string;
}

export interface ListInsightsQuery {
  category?: string;
  impact?: string;
  dateFrom?: string;
  dateTo?: string;
  websiteId?: string;
  page?: number;
  pageSize?: number;
}

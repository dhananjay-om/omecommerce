export interface ListInsightsQuery {
  category?: string;
  impact?: string;
  dateFrom?: string;
  dateTo?: string;
  websiteId?: string;
  page?: number;
  pageSize?: number;
}

export interface AiSettingsView {
  provider: string;
  model: string;
  /** Never the raw key — same "hasPassword, not password" contract as
   *  order/application/dto.ts's EmailSettingsView. */
  hasApiKey: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

export interface UpdateAiSettingsCommand {
  provider: string;
  /** Omitted/blank keeps the currently-saved key unchanged. */
  apiKey?: string;
  model: string;
  isActive: boolean;
}

export type NewsletterStatusValue = 'SUBSCRIBED' | 'UNSUBSCRIBED';

export interface SubscriberInfo {
  publicId: string;
  email: string;
  status: NewsletterStatusValue;
  source: string;
  websiteCode: string | null;
  unsubscribeToken: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
}

export interface ListSubscribersFilter {
  search?: string;
  status?: NewsletterStatusValue;
  page: number;
  pageSize: number;
}

export interface SubscriberCounts {
  total: number;
  subscribed: number;
  unsubscribed: number;
}

/** What a subscribe attempt actually changed — drives whether a welcome email
 *  is sent (only when something changed, never on a repeat sign-up). */
export type SubscribeOutcome = 'CREATED' | 'RESUBSCRIBED' | 'ALREADY_SUBSCRIBED';

export interface NewsletterRepository {
  subscribe(input: { email: string; source: string; websiteCode: string | null }): Promise<{ outcome: SubscribeOutcome; subscriber: SubscriberInfo }>;
  findByToken(token: string): Promise<SubscriberInfo | null>;
  findByPublicId(publicId: string): Promise<SubscriberInfo | null>;
  setStatus(publicId: string, status: NewsletterStatusValue): Promise<SubscriberInfo>;
  list(filter: ListSubscribersFilter): Promise<{ total: number; subscribers: SubscriberInfo[] }>;
  /** Every subscriber matching the filter, unpaginated — CSV export only. */
  listAll(filter: { search?: string; status?: NewsletterStatusValue }): Promise<SubscriberInfo[]>;
  counts(): Promise<SubscriberCounts>;
  delete(publicId: string): Promise<void>;
}

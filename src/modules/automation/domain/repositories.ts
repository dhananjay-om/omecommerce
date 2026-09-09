export type JobRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** The 8 real trigger types Phase 2 supports — each maps 1:1 to a real
 *  outbox eventType already flowing through DOMAIN_EVENTS_QUEUE (see
 *  EvaluateAutomationRules' own EVENT_TO_TRIGGER map). Plain string, not
 *  a DB enum — fixed vocabulary in app code, same precedent as
 *  triggerType/metricCode elsewhere in this session. */
export type AutomationTriggerType =
  | 'ORDER_PLACED'
  | 'ORDER_PAID'
  | 'ORDER_CANCELLED'
  | 'ORDER_REFUNDED'
  | 'ORDER_SHIPPED'
  | 'ORDER_CLOSED'
  | 'STOCK_CHANGED'
  | 'CUSTOMER_REGISTERED';

export type ConditionComparator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

export interface ConditionSpec {
  field: string;
  comparator: ConditionComparator;
  value: string;
}

export type ActionType = 'EMAIL' | 'WEBHOOK' | 'ORDER_NOTE';

export interface ActionSpec {
  type: ActionType;
  /** EMAIL: {recipient, subject, body}. WEBHOOK: {url}. ORDER_NOTE: {note?}. */
  config: Record<string, string>;
}

export interface AutomationRuleView {
  id: bigint;
  publicId: string;
  name: string;
  description: string | null;
  triggerType: AutomationTriggerType;
  conditions: ConditionSpec[];
  actions: ActionSpec[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAutomationRuleInput {
  name: string;
  description?: string | null;
  triggerType: AutomationTriggerType;
  conditions: ConditionSpec[];
  actions: ActionSpec[];
  isActive?: boolean;
}

/** triggerType is deliberately not editable — same "change the trigger by
 *  creating a new rule" precedent as Alerts' own immutable metricCode. */
export interface UpdateAutomationRuleInput {
  name?: string;
  description?: string | null;
  conditions?: ConditionSpec[];
  actions?: ActionSpec[];
  isActive?: boolean;
}

export interface AutomationRuleRepository {
  create(input: CreateAutomationRuleInput): Promise<AutomationRuleView>;
  update(publicId: string, input: UpdateAutomationRuleInput): Promise<AutomationRuleView>;
  delete(publicId: string): Promise<void>;
  findByPublicId(publicId: string): Promise<AutomationRuleView | null>;
  /** All rules — both the Rules and Workflows admin pages list from this
   *  same source, no filtering by which page created it. */
  list(): Promise<AutomationRuleView[]>;
  listActiveByTrigger(triggerType: AutomationTriggerType): Promise<AutomationRuleView[]>;
}

export interface ActionResult {
  type: ActionType;
  ok: boolean;
  error?: string;
}

export interface AutomationRuleRunView {
  id: bigint;
  ruleId: bigint;
  triggeredAt: Date;
  matched: boolean;
  entityType: string | null;
  entityPublicId: string | null;
  actionResults: ActionResult[];
}

export interface RecordAutomationRuleRunInput {
  ruleId: bigint;
  matched: boolean;
  entityType: string | null;
  entityPublicId: string | null;
  actionResults: ActionResult[];
}

export interface AutomationRuleRunRepository {
  record(input: RecordAutomationRuleRunInput): Promise<void>;
  listByRule(ruleId: bigint, limit: number): Promise<AutomationRuleRunView[]>;
}

export interface JobRunLogView {
  id: bigint;
  jobName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: JobRunStatus;
  errorMessage: string | null;
}

/** Backs the Scheduled Jobs admin page. BullMQ itself retains zero job
 *  history (both queues are configured removeOnComplete/removeOnFail —
 *  see queues.ts), so this is a real, separate record of what actually
 *  happened, written by each job handler itself via recordJobRun()
 *  (infrastructure/job-run-recorder.ts), not inferred from BullMQ. */
export interface JobRunLogRepository {
  recordStart(jobName: string): Promise<bigint>;
  recordFinish(id: bigint, status: 'SUCCEEDED' | 'FAILED', errorMessage?: string | null): Promise<void>;
  listRecent(jobName: string, limit: number): Promise<JobRunLogView[]>;
  lastRun(jobName: string): Promise<JobRunLogView | null>;
}

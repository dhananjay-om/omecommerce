export type MigrationChannel = 'SHOPIFY' | 'MAGENTO';
export type MigrationRunStatus = 'ANALYZING' | 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface MigrationConnectionInfo {
  id: bigint;
  publicId: string;
  channel: MigrationChannel;
  storeUrl: string;
  apiToken: string;
  isActive: boolean;
  lastTestedAt: Date | null;
  updatedAt: Date;
}

export interface UpsertMigrationConnectionInput {
  channel: MigrationChannel;
  storeUrl: string;
  /** Omitted keeps the currently-saved token unchanged — same "blank means
   *  don't touch it" contract as AiSettingsRepository.upsert's apiKey. */
  apiToken?: string;
  isActive?: boolean;
  createdBy: bigint | null;
  updatedBy: bigint | null;
}

export interface MigrationConnectionRepository {
  getByChannel(channel: MigrationChannel): Promise<MigrationConnectionInfo | null>;
  getById(id: bigint): Promise<MigrationConnectionInfo | null>;
  upsert(input: UpsertMigrationConnectionInput): Promise<MigrationConnectionInfo>;
  markTested(id: bigint): Promise<void>;
}

export interface MigrationRunInfo {
  id: bigint;
  publicId: string;
  connectionId: bigint;
  dataType: string;
  status: MigrationRunStatus;
  jobId: string | null;
  cancelRequested: boolean;
  totalItems: number | null;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  planJson: unknown;
  resultJson: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface CreateMigrationRunInput {
  connectionId: bigint;
  dataType: string;
  totalItems: number;
  planJson: unknown;
  createdBy: bigint | null;
}

export interface MigrationRunRepository {
  create(input: CreateMigrationRunInput): Promise<MigrationRunInfo>;
  findByPublicId(publicId: string): Promise<MigrationRunInfo | null>;
  findById(id: bigint): Promise<MigrationRunInfo | null>;
  listByConnectionId(connectionId: bigint, limit: number): Promise<MigrationRunInfo[]>;
  markStarted(id: bigint, jobId: string): Promise<void>;
  /** Cheap, frequent write — the worker calls this every few products, not
   *  every single one (see the worker's own doc comment), so
   *  GetMigrationRunStatus stays roughly correct even between BullMQ
   *  progress events without hammering Postgres on a large catalog. */
  updateProgress(id: bigint, processedItems: number, skippedItems: number, failedItems: number): Promise<void>;
  markCompleted(id: bigint, resultJson: unknown): Promise<void>;
  markFailed(id: bigint, resultJson: unknown): Promise<void>;
  /** Sets cancelRequested — only meaningful on a RUNNING run (validated by
   *  CancelMigrationRun, not here). The worker's own loop is what actually
   *  stops, cooperatively, the next time it checks. */
  requestCancel(id: bigint): Promise<void>;
  /** A cheap, single-column read — called before every product in the
   *  worker's loop (see its own doc comment on why that's fine cost-wise). */
  isCancelRequested(id: bigint): Promise<boolean>;
  markCancelled(id: bigint, resultJson: unknown): Promise<void>;
}

export interface MigrationExternalRefInfo {
  externalType: string;
  externalId: string;
  localPublicId: string;
}

export interface MigrationExternalRefRepository {
  find(connectionId: bigint, externalType: string, externalId: string): Promise<string | null>;
  /** Idempotent — re-recording the same (connectionId, externalType,
   *  externalId) is a harmless no-op (same "add is idempotent" precedent as
   *  WishlistItemRepository.add), which is what makes re-running a
   *  migration safe rather than erroring on the second run. */
  record(runId: bigint, connectionId: bigint, externalType: string, externalId: string, localPublicId: string): Promise<void>;
}

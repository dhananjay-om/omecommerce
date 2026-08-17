import type { CmsStatus } from '@prisma/client';

export interface CmsPageRecord {
  publicId: string;
  storeViewId: bigint | null;
  handle: string;
  title: string;
  body: string;
  status: CmsStatus;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface CreateCmsPageInput {
  storeViewId: bigint | null;
  handle: string;
  title: string;
  body: string;
}

export interface UpdateCmsPageInput {
  title?: string;
  body?: string;
  status?: CmsStatus;
}

export interface CmsPageRepository {
  create(input: CreateCmsPageInput): Promise<CmsPageRecord>;
  findByPublicId(publicId: string): Promise<CmsPageRecord | null>;
  /** Admin browse — every non-deleted page, newest-updated first (small, admin-authored table). */
  list(): Promise<CmsPageRecord[]>;
  update(publicId: string, input: UpdateCmsPageInput): Promise<CmsPageRecord>;
  softDelete(publicId: string): Promise<void>;
  existsByStoreViewAndHandle(storeViewId: bigint | null, handle: string): Promise<boolean>;
  /** Store-view-specific row first, falling back to the global (storeViewId=null) row. */
  resolveForStoreView(storeViewId: bigint, handle: string): Promise<CmsPageRecord | null>;
}

export interface CmsBlockRecord {
  publicId: string;
  storeViewId: bigint | null;
  code: string;
  body: string;
  status: CmsStatus;
  updatedAt: Date;
}

export interface CreateCmsBlockInput {
  storeViewId: bigint | null;
  code: string;
  body: string;
}

export interface UpdateCmsBlockInput {
  body?: string;
  status?: CmsStatus;
}

export interface CmsBlockRepository {
  create(input: CreateCmsBlockInput): Promise<CmsBlockRecord>;
  findByPublicId(publicId: string): Promise<CmsBlockRecord | null>;
  /** Admin browse — every non-deleted block, newest-updated first (small, admin-authored table). */
  list(): Promise<CmsBlockRecord[]>;
  update(publicId: string, input: UpdateCmsBlockInput): Promise<CmsBlockRecord>;
  softDelete(publicId: string): Promise<void>;
  existsByStoreViewAndCode(storeViewId: bigint | null, code: string): Promise<boolean>;
  resolveForStoreView(storeViewId: bigint, code: string): Promise<CmsBlockRecord | null>;
}

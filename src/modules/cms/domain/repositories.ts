import type { CmsStatus } from '@prisma/client';

export interface CmsPageRecord {
  publicId: string;
  storeViewId: bigint | null;
  handle: string;
  title: string;
  body: string;
  status: CmsStatus;
  publishedAt: Date | null;
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
  update(publicId: string, input: UpdateCmsPageInput): Promise<CmsPageRecord>;
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
  update(publicId: string, input: UpdateCmsBlockInput): Promise<CmsBlockRecord>;
  existsByStoreViewAndCode(storeViewId: bigint | null, code: string): Promise<boolean>;
  resolveForStoreView(storeViewId: bigint, code: string): Promise<CmsBlockRecord | null>;
}

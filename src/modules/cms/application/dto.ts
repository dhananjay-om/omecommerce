import type { CmsStatus } from '@prisma/client';

export interface CreateCmsPageCommand {
  storeViewId?: string | null;
  handle: string;
  title: string;
  body: string;
}

export interface UpdateCmsPageCommand {
  title?: string;
  body?: string;
  status?: CmsStatus;
}

export interface CmsPageView {
  publicId: string;
  handle: string;
  title: string;
  body: string;
  status: CmsStatus;
  publishedAt: string | null;
}

export interface CreateCmsBlockCommand {
  storeViewId?: string | null;
  code: string;
  body: string;
}

export interface UpdateCmsBlockCommand {
  body?: string;
  status?: CmsStatus;
}

export interface CmsBlockView {
  publicId: string;
  code: string;
  body: string;
  status: CmsStatus;
}

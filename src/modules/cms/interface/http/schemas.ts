import { z } from 'zod';
import { CmsStatus } from '@prisma/client';

export const createCmsPageSchema = z.object({
  storeViewId: z.string().regex(/^\d+$/).nullish(),
  handle: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  body: z.string().min(1),
});

export const updateCmsPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  body: z.string().min(1).optional(),
  status: z.nativeEnum(CmsStatus).optional(),
});

export const createCmsBlockSchema = z.object({
  storeViewId: z.string().regex(/^\d+$/).nullish(),
  code: z.string().min(1).max(255),
  body: z.string().min(1),
});

export const updateCmsBlockSchema = z.object({
  body: z.string().min(1).optional(),
  status: z.nativeEnum(CmsStatus).optional(),
});

export const cmsStoreViewQuerySchema = z.object({
  storeViewId: z.string().regex(/^\d+$/, 'storeViewId query param required'),
});

export const requestCmsImageUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
});

import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCmsPageRepository } from './infrastructure/prisma-cms-page.repository.js';
import { PrismaCmsBlockRepository } from './infrastructure/prisma-cms-block.repository.js';
import { CreateCmsPage, UpdateCmsPage } from './application/cms-page.usecases.js';
import { CreateCmsBlock, UpdateCmsBlock } from './application/cms-block.usecases.js';
import { GetCmsPage, GetCmsBlock } from './application/get-cms-content.usecases.js';
import {
  createCmsPageSchema,
  updateCmsPageSchema,
  createCmsBlockSchema,
  updateCmsBlockSchema,
  cmsStoreViewQuerySchema,
} from './interface/http/schemas.js';

export interface CmsRouters {
  admin: Router;
  store: Router;
}

/** Composition root for CMS content (plan/05 §2.7). */
export function createCmsModule(db: Db, authorize: (permission: string) => RequestHandler): CmsRouters {
  const pages = new PrismaCmsPageRepository(db);
  const blocks = new PrismaCmsBlockRepository(db);

  const createCmsPage = new CreateCmsPage(pages);
  const updateCmsPage = new UpdateCmsPage(pages);
  const createCmsBlock = new CreateCmsBlock(blocks);
  const updateCmsBlock = new UpdateCmsBlock(blocks);
  const getCmsPage = new GetCmsPage(pages);
  const getCmsBlock = new GetCmsBlock(blocks);

  const admin = Router();
  admin.post(
    '/cms/pages',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createCmsPageSchema, req.body);
      res.status(201).json({ data: await createCmsPage.execute(body) });
    }),
  );
  admin.put(
    '/cms/pages/:publicId',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateCmsPageSchema, req.body);
      res.json({ data: await updateCmsPage.execute(req.params.publicId!, body) });
    }),
  );
  admin.post(
    '/cms/blocks',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createCmsBlockSchema, req.body);
      res.status(201).json({ data: await createCmsBlock.execute(body) });
    }),
  );
  admin.put(
    '/cms/blocks/:publicId',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateCmsBlockSchema, req.body);
      res.json({ data: await updateCmsBlock.execute(req.params.publicId!, body) });
    }),
  );

  const store = Router();
  store.get(
    '/content/pages/:handle',
    asyncHandler(async (req, res) => {
      const query = parse(cmsStoreViewQuerySchema, req.query);
      res.json({ data: await getCmsPage.execute(req.params.handle!, query.storeViewId) });
    }),
  );
  store.get(
    '/content/blocks/:code',
    asyncHandler(async (req, res) => {
      const query = parse(cmsStoreViewQuerySchema, req.query);
      res.json({ data: await getCmsBlock.execute(req.params.code!, query.storeViewId) });
    }),
  );

  return { admin, store };
}

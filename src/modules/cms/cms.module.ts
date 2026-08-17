import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaCmsPageRepository } from './infrastructure/prisma-cms-page.repository.js';
import { PrismaCmsBlockRepository } from './infrastructure/prisma-cms-block.repository.js';
import { CreateCmsPage, UpdateCmsPage, ListCmsPages, GetCmsPageByPublicId, DeleteCmsPage } from './application/cms-page.usecases.js';
import { CreateCmsBlock, UpdateCmsBlock, ListCmsBlocks, GetCmsBlockByPublicId, DeleteCmsBlock } from './application/cms-block.usecases.js';
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
  const listCmsPages = new ListCmsPages(pages);
  const getCmsPageByPublicId = new GetCmsPageByPublicId(pages);
  const deleteCmsPage = new DeleteCmsPage(pages);
  const createCmsBlock = new CreateCmsBlock(blocks);
  const updateCmsBlock = new UpdateCmsBlock(blocks);
  const listCmsBlocks = new ListCmsBlocks(blocks);
  const getCmsBlockByPublicId = new GetCmsBlockByPublicId(blocks);
  const deleteCmsBlock = new DeleteCmsBlock(blocks);
  const getCmsPage = new GetCmsPage(pages);
  const getCmsBlock = new GetCmsBlock(blocks);

  const admin = Router();
  admin.get(
    '/cms/pages',
    authorize('cms:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCmsPages.execute() });
    }),
  );
  admin.get(
    '/cms/pages/:publicId',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getCmsPageByPublicId.execute(req.params.publicId!) });
    }),
  );
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
  admin.delete(
    '/cms/pages/:publicId',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      await deleteCmsPage.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );
  admin.get(
    '/cms/blocks',
    authorize('cms:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listCmsBlocks.execute() });
    }),
  );
  admin.get(
    '/cms/blocks/:publicId',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getCmsBlockByPublicId.execute(req.params.publicId!) });
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
  admin.delete(
    '/cms/blocks/:publicId',
    authorize('cms:manage'),
    asyncHandler(async (req, res) => {
      await deleteCmsBlock.execute(req.params.publicId!);
      res.status(204).send();
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

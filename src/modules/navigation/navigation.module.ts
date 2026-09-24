import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaMegaMenuItemRepository } from './infrastructure/prisma-mega-menu-item.repository.js';
import { CreateMegaMenuItem, UpdateMegaMenuItem, ListMegaMenuItems, GetMegaMenuItemByPublicId, DeleteMegaMenuItem, ListActiveMegaMenuItems } from './application/mega-menu.usecases.js';
import { PrismaTopBarRepository } from './infrastructure/prisma-top-bar.repository.js';
import { GetTopBar, SaveTopBar, ResetTopBar } from './application/top-bar.usecases.js';
import { RequestMegaMenuImageUpload } from './application/request-mega-menu-image-upload.usecase.js';
import { createMegaMenuItemSchema, updateMegaMenuItemSchema, requestMegaMenuImageUploadSchema, saveTopBarSchema, topBarQuerySchema } from './interface/http/schemas.js';

export interface NavigationRouters {
  admin: Router;
  store: Router;
}

/** Composition root for the storefront header's mega menu
 *  (Content > Mega Menu). */
export function createNavigationModule(db: Db, authorize: (permission: string) => RequestHandler): NavigationRouters {
  const items = new PrismaMegaMenuItemRepository(db);

  const createItem = new CreateMegaMenuItem(items);
  const updateItem = new UpdateMegaMenuItem(items);
  const listItems = new ListMegaMenuItems(items);
  const getItemByPublicId = new GetMegaMenuItemByPublicId(items);
  const deleteItem = new DeleteMegaMenuItem(items);
  const listActiveItems = new ListActiveMegaMenuItems(items);
  const requestImageUpload = new RequestMegaMenuImageUpload();
  const topBars = new PrismaTopBarRepository(db);
  const getTopBar = new GetTopBar(topBars);
  const saveTopBar = new SaveTopBar(topBars);
  const resetTopBar = new ResetTopBar(topBars);

  const admin = Router();
  admin.get(
    '/navigation/mega-menu-items',
    authorize('navigation:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listItems.execute() });
    }),
  );
  admin.get(
    '/navigation/mega-menu-items/:publicId',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getItemByPublicId.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/navigation/mega-menu-items',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createMegaMenuItemSchema, req.body);
      res.status(201).json({ data: await createItem.execute(body) });
    }),
  );
  admin.put(
    '/navigation/mega-menu-items/:publicId',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateMegaMenuItemSchema, req.body);
      res.json({ data: await updateItem.execute({ publicId: req.params.publicId!, ...body }) });
    }),
  );
  admin.delete(
    '/navigation/mega-menu-items/:publicId',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      await deleteItem.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );
  admin.post(
    '/navigation/mega-menu-items/image-upload-url',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(requestMegaMenuImageUploadSchema, req.body);
      res.status(201).json({ data: await requestImageUpload.execute(body) });
    }),
  );

  // Top bar (Content > Top Bar) — the thin strip above the header, per website.
  admin.get(
    '/navigation/top-bar/:websiteCode',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getTopBar.execute(req.params.websiteCode!) });
    }),
  );
  admin.put(
    '/navigation/top-bar/:websiteCode',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await saveTopBar.execute(req.params.websiteCode!, parse(saveTopBarSchema, req.body), null) });
    }),
  );
  admin.delete(
    '/navigation/top-bar/:websiteCode',
    authorize('navigation:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await resetTopBar.execute(req.params.websiteCode!) });
    }),
  );

  const store = Router();
  store.get(
    '/navigation/mega-menu',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listActiveItems.execute() });
    }),
  );

  store.get(
    '/navigation/top-bar',
    asyncHandler(async (req, res) => {
      res.json({ data: await getTopBar.execute(parse(topBarQuerySchema, req.query).websiteCode) });
    }),
  );

  return { admin, store };
}

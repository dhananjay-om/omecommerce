import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaMegaMenuItemRepository } from './infrastructure/prisma-mega-menu-item.repository.js';
import { CreateMegaMenuItem, UpdateMegaMenuItem, ListMegaMenuItems, GetMegaMenuItemByPublicId, DeleteMegaMenuItem, ListActiveMegaMenuItems } from './application/mega-menu.usecases.js';
import { RequestMegaMenuImageUpload } from './application/request-mega-menu-image-upload.usecase.js';
import { createMegaMenuItemSchema, updateMegaMenuItemSchema, requestMegaMenuImageUploadSchema } from './interface/http/schemas.js';

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

  const store = Router();
  store.get(
    '/navigation/mega-menu',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listActiveItems.execute() });
    }),
  );

  return { admin, store };
}

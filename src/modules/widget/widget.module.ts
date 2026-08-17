import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWidgetInstanceRepository } from './infrastructure/prisma-widget.repository.js';
import {
  CreateWidgetInstance,
  UpdateWidgetInstance,
  ListWidgetInstances,
  GetWidgetInstanceByPublicId,
  DeleteWidgetInstance,
  ListActiveWidgetsForSection,
} from './application/widget.usecases.js';
import { createWidgetInstanceSchema, updateWidgetInstanceSchema, widgetPageQuerySchema, widgetSectionQuerySchema } from './interface/http/schemas.js';

export interface WidgetRouters {
  admin: Router;
  store: Router;
}

/** Composition root for placeable content widgets (Content > Widgets) —
 *  the "which typed content shows in which layout zone, in what order"
 *  placement layer sitting on top of cms (Pages/Blocks) and banner. */
export function createWidgetModule(db: Db, authorize: (permission: string) => RequestHandler): WidgetRouters {
  const widgets = new PrismaWidgetInstanceRepository(db);

  const createWidget = new CreateWidgetInstance(widgets);
  const updateWidget = new UpdateWidgetInstance(widgets);
  const listWidgets = new ListWidgetInstances(widgets);
  const getWidgetByPublicId = new GetWidgetInstanceByPublicId(widgets);
  const deleteWidget = new DeleteWidgetInstance(widgets);
  const listActiveWidgetsForSection = new ListActiveWidgetsForSection(widgets);

  const admin = Router();
  admin.get(
    '/widgets',
    authorize('widget:manage'),
    asyncHandler(async (req, res) => {
      const query = parse(widgetPageQuerySchema, req.query);
      res.json({ data: await listWidgets.execute(query.page) });
    }),
  );
  admin.get(
    '/widgets/:publicId',
    authorize('widget:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getWidgetByPublicId.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/widgets',
    authorize('widget:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createWidgetInstanceSchema, req.body);
      res.status(201).json({ data: await createWidget.execute(body) });
    }),
  );
  admin.put(
    '/widgets/:publicId',
    authorize('widget:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateWidgetInstanceSchema, req.body);
      res.json({ data: await updateWidget.execute({ publicId: req.params.publicId!, ...body }) });
    }),
  );
  admin.delete(
    '/widgets/:publicId',
    authorize('widget:manage'),
    asyncHandler(async (req, res) => {
      await deleteWidget.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );

  const store = Router();
  store.get(
    '/widgets',
    asyncHandler(async (req, res) => {
      const query = parse(widgetSectionQuerySchema, req.query);
      res.json({ data: await listActiveWidgetsForSection.execute(query.page, query.section) });
    }),
  );

  return { admin, store };
}

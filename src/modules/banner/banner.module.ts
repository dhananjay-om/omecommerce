import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaBannerRepository } from './infrastructure/prisma-banner.repository.js';
import { CreateBanner, UpdateBanner, ListBanners, GetBannerByPublicId, DeleteBanner } from './application/banner.usecases.js';
import { ListActiveBanners } from './application/list-active-banners.usecase.js';
import { RequestBannerImageUpload } from './application/request-banner-image-upload.usecase.js';
import { createBannerSchema, updateBannerSchema, requestBannerImageUploadSchema, bannerGroupQuerySchema } from './interface/http/schemas.js';

export interface BannerRouters {
  admin: Router;
  store: Router;
}

/** Composition root for placeable marketing banners (Content > Banners). */
export function createBannerModule(db: Db, authorize: (permission: string) => RequestHandler): BannerRouters {
  const banners = new PrismaBannerRepository(db);

  const createBanner = new CreateBanner(banners);
  const updateBanner = new UpdateBanner(banners);
  const listBanners = new ListBanners(banners);
  const getBannerByPublicId = new GetBannerByPublicId(banners);
  const deleteBanner = new DeleteBanner(banners);
  const listActiveBanners = new ListActiveBanners(banners);
  const requestBannerImageUpload = new RequestBannerImageUpload();

  const admin = Router();
  admin.get(
    '/banners',
    authorize('banner:manage'),
    asyncHandler(async (_req, res) => {
      res.json({ data: await listBanners.execute() });
    }),
  );
  admin.get(
    '/banners/:publicId',
    authorize('banner:manage'),
    asyncHandler(async (req, res) => {
      res.json({ data: await getBannerByPublicId.execute(req.params.publicId!) });
    }),
  );
  admin.post(
    '/banners',
    authorize('banner:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(createBannerSchema, req.body);
      res.status(201).json({ data: await createBanner.execute(body) });
    }),
  );
  admin.put(
    '/banners/:publicId',
    authorize('banner:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(updateBannerSchema, req.body);
      res.json({ data: await updateBanner.execute({ publicId: req.params.publicId!, ...body }) });
    }),
  );
  admin.delete(
    '/banners/:publicId',
    authorize('banner:manage'),
    asyncHandler(async (req, res) => {
      await deleteBanner.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );
  admin.post(
    '/banners/image-upload-url',
    authorize('banner:manage'),
    asyncHandler(async (req, res) => {
      const body = parse(requestBannerImageUploadSchema, req.body);
      res.status(201).json({ data: await requestBannerImageUpload.execute(body) });
    }),
  );

  const store = Router();
  store.get(
    '/banners',
    asyncHandler(async (req, res) => {
      const query = parse(bannerGroupQuerySchema, req.query);
      res.json({ data: await listActiveBanners.execute(query.group) });
    }),
  );

  return { admin, store };
}

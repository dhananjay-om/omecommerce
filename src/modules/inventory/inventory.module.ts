import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWarehouseRepository, PrismaVariantLookup } from './infrastructure/prisma-warehouse.repository.js';
import { PrismaStockLedger } from './infrastructure/prisma-stock-ledger.js';
import { CreateWarehouse } from './application/create-warehouse.usecase.js';
import { ListWarehouses } from './application/list-warehouses.usecase.js';
import { ListWarehouseStock } from './application/list-warehouse-stock.usecase.js';
import { ListVariantStock } from './application/list-variant-stock.usecase.js';
import { AdjustStock } from './application/adjust-stock.usecase.js';
import { GetStock } from './application/get-stock.usecase.js';
import { ReserveStock } from './application/reserve-stock.usecase.js';
import { CommitReservation } from './application/commit-reservation.usecase.js';
import { ReleaseReservation } from './application/release-reservation.usecase.js';
import { ReleaseExpiredReservations } from './application/release-expired-reservations.usecase.js';
import {
  createWarehouseSchema,
  adjustStockSchema,
  getStockQuerySchema,
  reserveStockSchema,
} from './interface/http/schemas.js';

export interface InventoryRouters {
  admin: Router;
}

/** Composition root for the Inventory module — wires ports to Prisma adapters. */
export function createInventoryModule(db: Db, authorize: (permission: string) => RequestHandler): InventoryRouters {
  const warehouses = new PrismaWarehouseRepository(db);
  const variants = new PrismaVariantLookup(db);
  const ledger = new PrismaStockLedger(db);

  const createWarehouse = new CreateWarehouse(warehouses);
  const listWarehouses = new ListWarehouses(warehouses);
  const listWarehouseStock = new ListWarehouseStock(warehouses, ledger);
  const listVariantStock = new ListVariantStock(variants, ledger);
  const adjustStock = new AdjustStock(variants, warehouses, ledger);
  const getStock = new GetStock(variants, warehouses, ledger);
  const reserveStock = new ReserveStock(variants, warehouses, ledger);
  const commitReservation = new CommitReservation(ledger);
  const releaseReservation = new ReleaseReservation(ledger);
  const releaseExpiredReservations = new ReleaseExpiredReservations(ledger);

  const admin = Router();

  admin.post(
    '/warehouses',
    asyncHandler(async (req, res) => {
      const body = parse(createWarehouseSchema, req.body);
      const view = await createWarehouse.execute(body);
      res.status(201).json({ data: view });
    }),
  );

  admin.get(
    '/warehouses',
    asyncHandler(async (_req, res) => {
      res.json({ data: await listWarehouses.execute() });
    }),
  );

  admin.get(
    '/inventory/warehouses/:code/stock',
    asyncHandler(async (req, res) => {
      res.json({ data: await listWarehouseStock.execute(req.params.code!) });
    }),
  );

  admin.post(
    '/inventory/adjustments',
    authorize('inventory:adjust'),
    asyncHandler(async (req, res) => {
      const body = parse(adjustStockSchema, req.body);
      const view = await adjustStock.execute({
        variantPublicId: body.variantId,
        warehouseCode: body.warehouseCode,
        delta: body.delta,
        reason: body.reason,
        note: body.note,
      });
      res.status(201).json({ data: view });
    }),
  );

  admin.get(
    '/inventory/stock',
    asyncHandler(async (req, res) => {
      const query = parse(getStockQuerySchema, req.query);
      const view = await getStock.execute({
        variantPublicId: query.variantId,
        warehouseCode: query.warehouseCode,
      });
      res.json({ data: view });
    }),
  );

  admin.get(
    '/variants/:variantId/stock',
    asyncHandler(async (req, res) => {
      res.json({ data: await listVariantStock.execute(req.params.variantId!) });
    }),
  );

  admin.post(
    '/inventory/reservations',
    asyncHandler(async (req, res) => {
      const body = parse(reserveStockSchema, req.body);
      const view = await reserveStock.execute({
        variantPublicId: body.variantId,
        warehouseCode: body.warehouseCode,
        qty: body.qty,
        refType: body.refType,
        refId: body.refId,
        ttlSeconds: body.ttlSeconds,
      });
      res.status(201).json({ data: view });
    }),
  );

  admin.post(
    '/inventory/reservations/:publicId/commit',
    asyncHandler(async (req, res) => {
      await commitReservation.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );

  admin.post(
    '/inventory/reservations/:publicId/release',
    asyncHandler(async (req, res) => {
      await releaseReservation.execute(req.params.publicId!);
      res.status(204).send();
    }),
  );

  // Also scheduled as a repeatable BullMQ job (src/workers/reservation-sweep.worker.ts);
  // this endpoint remains for on-demand/manual runs and tests.
  admin.post(
    '/inventory/reservations/sweep-expired',
    asyncHandler(async (_req, res) => {
      const result = await releaseExpiredReservations.execute();
      res.json({ data: result });
    }),
  );

  return { admin };
}

import { Router, type RequestHandler } from 'express';
import type { Db } from '../../shared/infrastructure/prisma/client.js';
import { parse, asyncHandler } from '../../shared/interface/http/validate.js';
import { PrismaWishlistRepository } from './infrastructure/prisma-wishlist.repository.js';
import { PrismaWishlistItemRepository } from './infrastructure/prisma-wishlist-item.repository.js';
import { PrismaProductExistenceLookup, PrismaCustomerLookup } from './infrastructure/lookups.js';
import { CreateWishlist } from './application/create-wishlist.usecase.js';
import { ListWishlists } from './application/list-wishlists.usecase.js';
import { AddWishlistItem } from './application/add-wishlist-item.usecase.js';
import { RemoveWishlistItem } from './application/remove-wishlist-item.usecase.js';
import { createWishlistSchema, addWishlistItemSchema } from './interface/http/schemas.js';

export interface WishlistModule {
  store: Router;
}

/**
 * Composition root for storefront Wishlists (plan/05 §2.6). `requireCustomer`
 * is the SAME `authenticateCustomer` middleware instance the Customer module
 * exports — not a re-implementation — so a wishlist-scoped route and a
 * customer-scoped route authenticate identically.
 */
export function createWishlistModule(db: Db, requireCustomer: RequestHandler): WishlistModule {
  const wishlists = new PrismaWishlistRepository(db);
  const items = new PrismaWishlistItemRepository(db);
  const products = new PrismaProductExistenceLookup(db);
  const customers = new PrismaCustomerLookup(db);

  const createWishlist = new CreateWishlist(wishlists, customers);
  const listWishlists = new ListWishlists(wishlists, items, customers);
  const addWishlistItem = new AddWishlistItem(wishlists, items, products, customers);
  const removeWishlistItem = new RemoveWishlistItem(wishlists, items, products, customers);

  const store = Router();
  store.get(
    '/me/wishlists',
    requireCustomer,
    asyncHandler(async (req, res) => {
      res.json({ data: await listWishlists.execute(req.customer!.customerPublicId) });
    }),
  );
  store.post(
    '/me/wishlists',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(createWishlistSchema, req.body);
      res.status(201).json({ data: await createWishlist.execute({ customerPublicId: req.customer!.customerPublicId, ...body }) });
    }),
  );
  store.post(
    '/me/wishlists/:id/items',
    requireCustomer,
    asyncHandler(async (req, res) => {
      const body = parse(addWishlistItemSchema, req.body);
      await addWishlistItem.execute({
        customerPublicId: req.customer!.customerPublicId,
        wishlistPublicId: req.params.id!,
        productPublicId: body.productId,
      });
      res.status(204).send();
    }),
  );
  store.delete(
    '/me/wishlists/:id/items/:productPublicId',
    requireCustomer,
    asyncHandler(async (req, res) => {
      await removeWishlistItem.execute({
        customerPublicId: req.customer!.customerPublicId,
        wishlistPublicId: req.params.id!,
        productPublicId: req.params.productPublicId!,
      });
      res.status(204).send();
    }),
  );

  return { store };
}

import { z } from 'zod';

export const createWishlistSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export const addWishlistItemSchema = z.object({
  productId: z.string().min(1),
});

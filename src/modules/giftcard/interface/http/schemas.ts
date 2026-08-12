import { z } from 'zod';
import { GiftCardKind } from '@prisma/client';

export const issueGiftCardSchema = z.object({
  websiteCode: z.string().min(1),
  amount: z.string().min(1),
  kind: z.nativeEnum(GiftCardKind).optional(),
  recipientEmail: z.string().email().nullish(),
  recipientName: z.string().max(255).nullish(),
  message: z.string().max(2000).nullish(),
  expiresAt: z.string().datetime().nullish(),
});

export const adjustGiftCardSchema = z.object({
  amount: z.string().min(1),
  reason: z.string().min(1).max(1000),
});

export const redeemGiftCardSchema = z.object({
  code: z.string().min(1),
});

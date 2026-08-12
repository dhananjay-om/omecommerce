import { z } from 'zod';
import { WalletBucket, WalletSource } from '@prisma/client';

export const creditWalletSchema = z.object({
  amount: z.string().min(1),
  bucket: z.nativeEnum(WalletBucket),
  source: z.nativeEnum(WalletSource),
  reason: z.string().max(1000).optional(),
});

export const adjustWalletSchema = z.object({
  amount: z.string().min(1),
  bucket: z.nativeEnum(WalletBucket),
  reason: z.string().min(1).max(1000),
});

import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../../../config/env.js';

/**
 * Global soft-delete extension (plan/02-prisma-schema-and-migrations.md §4).
 * - Reads exclude rows where deletedAt IS NOT NULL.
 * - delete/deleteMany are remapped to set deletedAt (soft delete).
 * Append-only tables (audit/outbox/ledgers) are NOT soft-deleted; they simply have
 * no deletedAt column, so the where-injection is a no-op for them.
 */
const APPEND_ONLY = new Set<string>([
  // add ledger/audit/outbox model names here as they are introduced
  'CategoryClosure',
]);

function hasDeletedAt(model: string | undefined): boolean {
  if (!model) return false;
  if (APPEND_ONLY.has(model)) return false;
  const meta = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  return !!meta?.fields.some((f) => f.name === 'deletedAt');
}

const base = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export const prisma = base.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (hasDeletedAt(model)) args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (hasDeletedAt(model)) args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      async count({ model, args, query }) {
        if (hasDeletedAt(model)) args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      async delete({ model, args, query }) {
        if (hasDeletedAt(model)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (base as any)[lower(model)].update({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        }
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        if (hasDeletedAt(model)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (base as any)[lower(model)].updateMany({
            where: args.where,
            data: { deletedAt: new Date() },
          });
        }
        return query(args);
      },
    },
  },
});

function lower(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export type Db = typeof prisma;

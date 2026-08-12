import type { ZodSchema } from 'zod';
import { ValidationError } from '../../domain/errors.js';

/** Parse with a zod schema, converting failures into a domain ValidationError. */
export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncHandler(fn: (...args: any[]) => Promise<unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, res: any, next: any) => fn(req, res, next).catch(next);
}

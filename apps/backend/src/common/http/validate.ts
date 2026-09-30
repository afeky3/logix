import { z } from 'zod';
import { AppError } from '../errors/app-error';

/** Parses a request body against a zod schema, throwing the standard
 * VALIDATION_FAILED envelope (05-api-conventions.md §5) on failure. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError('VALIDATION_FAILED', 'Invalid request body', {
      details: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        code: i.code,
      })),
    });
  }
  return result.data;
}

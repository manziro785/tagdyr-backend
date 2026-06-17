import type { Context } from 'hono';
import type { z } from 'zod';
import { validation } from './errors.js';

/** Парсит JSON-тело по zod-схеме; невалидное → AppError VALIDATION (422). */
export async function parseBody<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw validation('Invalid JSON body');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw validation('Request body validation failed', result.error.flatten());
  }
  return result.data;
}

/** Парсит query/params по zod-схеме. */
export function parseInput<T extends z.ZodTypeAny>(input: unknown, schema: T): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw validation('Request validation failed', result.error.flatten());
  }
  return result.data;
}

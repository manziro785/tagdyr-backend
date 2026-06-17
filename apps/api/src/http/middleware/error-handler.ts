import type { Context } from 'hono';
import { AppError, internal, sendError } from '../errors.js';
import type { AppEnv } from '../context.js';

/**
 * Глобальный обработчик ошибок (Hono onError). Доменные AppError отдаём как есть,
 * неизвестные — как INTERNAL 500, не протекая деталями наружу. Логируем с request-id.
 */
export function errorHandler(err: Error, c: Context<AppEnv>) {
  const requestId = c.get('requestId');

  if (err instanceof AppError) {
    if (err.code === 'INTERNAL') {
      console.error(`[${requestId}] AppError INTERNAL:`, err.message, err.details);
    }
    return sendError(c, err);
  }

  // непредвиденное — лог целиком, наружу безопасный 500
  console.error(`[${requestId}] Unhandled error:`, err);
  return sendError(c, internal());
}

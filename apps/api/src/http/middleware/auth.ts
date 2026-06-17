import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../context.js';
import { unauthorized } from '../errors.js';
import { verifyAccessToken } from '../../auth/jwt.js';

/**
 * Проверяет Bearer-токен и кладёт userId в контекст (§4). Бросает AppError —
 * его подхватит глобальный error handler.
 */
export const authMiddleware = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  const userId = await verifyAccessToken(token);
  c.set('userId', userId);
  await next();
};

/** Достаёт userId из контекста; бросает, если middleware не отработал. */
export function requireUserId(c: { get: (k: 'userId') => string | undefined }): string {
  const userId = c.get('userId');
  if (!userId) throw unauthorized('Not authenticated');
  return userId;
}

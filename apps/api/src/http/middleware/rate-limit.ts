import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../context.js';
import { rateLimited } from '../errors.js';
import { requireUserId } from './auth.js';

/**
 * Простой per-user rate limit со скользящим окном (§10). Состояние — в памяти
 * процесса: на одном инстансе Render этого достаточно. КОМПРОМИСС: при
 * масштабировании на несколько инстансов лимит станет per-instance — тогда
 * нужен общий стор (Redis/Upstash). Ставим только на записывающие/AI-роуты.
 *
 * Требует authMiddleware выше по цепочке — ключ лимита это userId.
 */
export interface RateLimitOptions {
  /** Разрешённых запросов за окно. */
  limit: number;
  /** Длина окна в миллисекундах. */
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = requireUserId(c);
    const now = Date.now();
    // ключ включает путь: лимиты разных роутов не «съедают» друг друга
    const key = `${userId}:${c.req.routePath}`;

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, opts.limit - bucket.count);
    const resetSec = Math.ceil((bucket.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(opts.limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSec));

    if (bucket.count > opts.limit) {
      c.header('Retry-After', String(resetSec));
      throw rateLimited('Too many requests, slow down');
    }

    await next();
  };
}

/** Только для тестов: сбросить накопленные окна. */
export function resetRateLimits(): void {
  buckets.clear();
}

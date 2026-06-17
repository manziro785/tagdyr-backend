import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadEnv } from './config/env.js';
import type { AppEnv } from './http/context.js';
import { requestId } from './http/middleware/request-id.js';
import { errorHandler } from './http/middleware/error-handler.js';
import { notFound, sendError } from './http/errors.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { livesRoutes } from './routes/lives.js';

export function createApp() {
  const env = loadEnv();
  const app = new Hono<AppEnv>();

  app.use('*', requestId());
  app.use(
    '*',
    cors({
      origin: env.CORS_ORIGINS,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
      exposeHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
      maxAge: 600,
    }),
  );

  // публичные
  app.route('/api/v1', healthRoutes);
  app.route('/api/v1/auth', authRoutes);

  // приватные (auth-middleware внутри роутеров)
  app.route('/api/v1/me', meRoutes);
  app.route('/api/v1/lives', livesRoutes);

  // 404 в едином формате
  app.notFound((c) => sendError(c, notFound(`Route not found: ${c.req.method} ${c.req.path}`)));

  // единый обработчик ошибок
  app.onError(errorHandler);

  return app;
}

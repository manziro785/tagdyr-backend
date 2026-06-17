import { Hono } from 'hono';
import type { AppEnv } from '../http/context.js';

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/health', (c) =>
  c.json({ status: 'ok', requestId: c.get('requestId'), time: new Date().toISOString() }),
);

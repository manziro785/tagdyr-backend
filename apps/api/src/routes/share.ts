import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../http/context.js';
import { parseInput } from '../http/validate.js';
import { getSharedLife } from '../services/share.service.js';

/**
 * Публичный share (§5.4): данные жизни по неперебираемому токену, без авторизации.
 * Используется фронтом для OG-карточки и раскрытия ссылки. Отдаём только
 * безопасный срез (см. share.service).
 */
export const shareRoutes = new Hono<AppEnv>();

const tokenParam = z.object({ token: z.string().min(10).max(64) });

// GET /share/:token — публичный срез жизни
shareRoutes.get('/:token', async (c) => {
  const { token } = parseInput(c.req.param(), tokenParam);
  return c.json(await getSharedLife(token));
});

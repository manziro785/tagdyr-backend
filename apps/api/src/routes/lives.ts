import { Hono } from 'hono';
import { z } from 'zod';
import {
  createLifeRequestSchema,
  completeSeasonRequestSchema,
  rewindRequestSchema,
} from '@tagdyr/schemas';
import type { AppEnv } from '../http/context.js';
import { authMiddleware, requireUserId } from '../http/middleware/auth.js';
import { parseBody, parseInput } from '../http/validate.js';
import { validation } from '../http/errors.js';
import * as livesService from '../services/lives.service.js';
import { completeSeason } from '../services/complete-season.service.js';
import { rewindLife } from '../services/rewind.service.js';
import { compareLives } from '../services/compare.service.js';

export const livesRoutes = new Hono<AppEnv>();

livesRoutes.use('*', authMiddleware());

const idParam = z.object({ id: z.string().uuid('Invalid life id') });
const seasonParams = z.object({
  id: z.string().uuid('Invalid life id'),
  n: z.coerce.number().int().min(1).max(5),
});
const compareQuery = z.object({
  a: z.string().uuid('Invalid life id in "a"'),
  b: z.string().uuid('Invalid life id in "b"'),
});

// GET /lives — список слотов
livesRoutes.get('/', async (c) => {
  const userId = requireUserId(c);
  return c.json(await livesService.listLives(userId));
});

// POST /lives — начать новую жизнь
livesRoutes.post('/', async (c) => {
  const userId = requireUserId(c);
  const body = await parseBody(c, createLifeRequestSchema);
  const life = await livesService.createLife(userId, body);
  return c.json(life, 201);
});

// GET /lives/compare?a=&b= — данные двух жизней для экрана сравнения
// ВАЖНО: регистрируем ДО /:id, чтобы статический сегмент не перехватился параметром.
livesRoutes.get('/compare', async (c) => {
  const userId = requireUserId(c);
  const { a, b } = parseInput(c.req.query(), compareQuery);
  return c.json(await compareLives({ userId, aId: a, bId: b }));
});

// GET /lives/:id — полный LifeState + последний снапшот
livesRoutes.get('/:id', async (c) => {
  const userId = requireUserId(c);
  const { id } = parseInput(c.req.param(), idParam);
  return c.json(await livesService.getLife(userId, id));
});

// DELETE /lives/:id — архивировать слот
livesRoutes.delete('/:id', async (c) => {
  const userId = requireUserId(c);
  const { id } = parseInput(c.req.param(), idParam);
  await livesService.archiveLife(userId, id);
  return c.body(null, 204);
});

// POST /lives/:id/seasons/:n/complete — завершение сезона (главный)
livesRoutes.post('/:id/seasons/:n/complete', async (c) => {
  const userId = requireUserId(c);
  const { id, n } = parseInput(c.req.param(), seasonParams);
  const body = await parseBody(c, completeSeasonRequestSchema);

  // ключ идемпотентности: заголовок Idempotency-Key, иначе seed (§6.1.2 + §10)
  const idempotencyKey = c.req.header('idempotency-key')?.trim() || body.seed;
  if (!idempotencyKey) throw validation('Missing idempotency key or seed');

  const result = await completeSeason({
    userId,
    lifeId: id,
    seasonNumber: n,
    body,
    idempotencyKey,
  });
  return c.json(result);
});

// POST /lives/:id/rewind — «переписать судьбу»
livesRoutes.post('/:id/rewind', async (c) => {
  const userId = requireUserId(c);
  const { id } = parseInput(c.req.param(), idParam);
  const body = await parseBody(c, rewindRequestSchema);
  return c.json(await rewindLife({ userId, lifeId: id, toSeason: body.toSeason }));
});

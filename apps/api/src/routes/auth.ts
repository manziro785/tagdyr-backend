import { Hono } from 'hono';
import { refreshRequestSchema } from '@tagdyr/schemas';
import type { AppEnv } from '../http/context.js';
import { parseBody } from '../http/validate.js';
import { unauthorized } from '../http/errors.js';
import { db } from '../db/client.js';
import { usersRepo } from '../repositories/users.repo.js';
import { issueTokenPair, verifyRefreshToken } from '../auth/jwt.js';

export const authRoutes = new Hono<AppEnv>();

// POST /auth/refresh — обновить access по refresh (с проверкой, что юзер ещё существует)
authRoutes.post('/refresh', async (c) => {
  const body = await parseBody(c, refreshRequestSchema);
  const userId = await verifyRefreshToken(body.refreshToken);

  const user = await usersRepo.findById(db, userId);
  if (!user) throw unauthorized('User no longer exists');

  const tokens = await issueTokenPair(userId);
  return c.json(tokens);
});

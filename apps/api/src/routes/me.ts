import { Hono } from 'hono';
import { updateMeRequestSchema, type Me } from '@tagdyr/schemas';
import type { AppEnv } from '../http/context.js';
import { authMiddleware, requireUserId } from '../http/middleware/auth.js';
import { parseBody } from '../http/validate.js';
import { notFound } from '../http/errors.js';
import { db } from '../db/client.js';
import { usersRepo } from '../repositories/users.repo.js';
import type { UserRow } from '../db/schema.js';

export const meRoutes = new Hono<AppEnv>();

meRoutes.use('*', authMiddleware());

function toMe(u: UserRow): Me {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    locale: u.locale,
  };
}

// GET /me — профиль
meRoutes.get('/', async (c) => {
  const userId = requireUserId(c);
  const user = await usersRepo.findById(db, userId);
  if (!user) throw notFound('User not found');
  return c.json(toMe(user));
});

// PATCH /me — смена display_name / locale
meRoutes.patch('/', async (c) => {
  const userId = requireUserId(c);
  const body = await parseBody(c, updateMeRequestSchema);
  const updated = await usersRepo.update(db, userId, {
    ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
    ...(body.locale !== undefined ? { locale: body.locale } : {}),
  });
  return c.json(toMe(updated));
});

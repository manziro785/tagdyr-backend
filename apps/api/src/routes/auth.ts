import { Hono } from 'hono';
import {
  refreshRequestSchema,
  registerRequestSchema,
  loginRequestSchema,
  type AuthResponse,
  type Me,
} from '@tagdyr/schemas';
import type { AppEnv } from '../http/context.js';
import { parseBody } from '../http/validate.js';
import { conflict, unauthorized } from '../http/errors.js';
import { db } from '../db/client.js';
import { usersRepo } from '../repositories/users.repo.js';
import { issueTokenPair, verifyRefreshToken } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { UserRow } from '../db/schema.js';

export const authRoutes = new Hono<AppEnv>();

function toMe(u: UserRow): Me {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    locale: u.locale,
  };
}

async function toAuthResponse(user: UserRow): Promise<AuthResponse> {
  const tokens = await issueTokenPair(user.id);
  return { ...tokens, user: toMe(user) };
}

// POST /auth/register — регистрация по email + пароль
authRoutes.post('/register', async (c) => {
  const body = await parseBody(c, registerRequestSchema);

  const existing = await usersRepo.findByEmail(db, body.email);
  if (existing) throw conflict('Email already registered');

  const passwordHash = await hashPassword(body.password);
  const user = await usersRepo.insert(db, {
    provider: 'email',
    providerId: body.email,
    email: body.email,
    displayName: body.displayName,
    passwordHash,
  });

  return c.json(await toAuthResponse(user), 201);
});

// POST /auth/login — вход по email + пароль
authRoutes.post('/login', async (c) => {
  const body = await parseBody(c, loginRequestSchema);

  const user = await usersRepo.findByEmail(db, body.email);
  // единое сообщение — не раскрываем, существует ли email (§11)
  if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
    throw unauthorized('Invalid email or password');
  }

  return c.json(await toAuthResponse(user));
});

// POST /auth/refresh — обновить access по refresh (с проверкой, что юзер ещё существует)
authRoutes.post('/refresh', async (c) => {
  const body = await parseBody(c, refreshRequestSchema);
  const userId = await verifyRefreshToken(body.refreshToken);

  const user = await usersRepo.findById(db, userId);
  if (!user) throw unauthorized('User no longer exists');

  const tokens = await issueTokenPair(userId);
  return c.json(tokens);
});

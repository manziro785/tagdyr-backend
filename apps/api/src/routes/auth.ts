import { Hono } from 'hono';
import {
  refreshRequestSchema,
  registerRequestSchema,
  loginRequestSchema,
  googleAuthRequestSchema,
  type AuthResponse,
  type Me,
} from '@tagdyr/schemas';
import { loadEnv } from '../config/env.js';
import type { AppEnv } from '../http/context.js';
import { parseBody } from '../http/validate.js';
import { conflict, notFound, unauthorized } from '../http/errors.js';
import { db } from '../db/client.js';
import { usersRepo } from '../repositories/users.repo.js';
import { verifyGoogleIdToken, type GoogleProfile } from '../auth/google.js';
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

// POST /auth/google — вход по ID-токену Google Identity Services
authRoutes.post('/google', async (c) => {
  const env = loadEnv();
  // фича за флагом: без client id роута «как бы нет»
  if (!env.GOOGLE_CLIENT_ID) throw notFound('Google sign-in is not configured');

  const body = await parseBody(c, googleAuthRequestSchema);

  let profile: GoogleProfile;
  try {
    profile = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
  } catch {
    throw unauthorized('Invalid Google token');
  }
  // без подтверждённого email нельзя безопасно матчить с email-аккаунтами
  if (!profile.email || !profile.emailVerified) {
    throw unauthorized('Google account has no verified email');
  }

  // сперва по стабильному sub, затем по email — чтобы владелец
  // email-аккаунта входил через Google в свой же аккаунт
  let user =
    (await usersRepo.findByProvider(db, 'google', profile.sub)) ??
    (await usersRepo.findByEmail(db, profile.email));

  if (!user) {
    user = await usersRepo.insert(db, {
      provider: 'google',
      providerId: profile.sub,
      email: profile.email,
      displayName: profile.name ?? profile.email.split('@')[0]!,
      avatarUrl: profile.picture,
      passwordHash: null,
    });
    return c.json(await toAuthResponse(user), 201);
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

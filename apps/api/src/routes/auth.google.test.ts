import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import type { Hono } from 'hono';
import type { AuthResponse, ApiError } from '@tagdyr/schemas';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import type { GoogleProfile } from '../auth/google.js';

// проверку подписи мокаем: сетевых походов к Google в тестах быть не должно
vi.mock('../auth/google.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

const { verifyGoogleIdToken } = await import('../auth/google.js');
const mockVerify = vi.mocked(verifyGoogleIdToken);

const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

const TEST_URL = getTestDbUrl();

const PROFILE: GoogleProfile = {
  sub: 'google-sub-1',
  email: 'aizhan@example.kg',
  emailVerified: true,
  name: 'Айжан',
  picture: null,
};

function googleAuth(app: Hono, idToken = 'x'.repeat(32)) {
  return app.request('/api/v1/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
}

describe('POST /auth/google (без GOOGLE_CLIENT_ID)', () => {
  let app: Hono;
  // тесты в одном форке (singleFork) — env обязан вернуться как был,
  // иначе фиктивный DATABASE_URL «расскипает» интеграционные файлы дальше
  let prevDbUrl: string | undefined;
  let prevClientId: string | undefined;

  beforeAll(async () => {
    prevDbUrl = process.env.DATABASE_URL;
    prevClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/tagdyr';
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';
    delete process.env.GOOGLE_CLIENT_ID;
    const { resetEnvCache } = await import('../config/env.js');
    resetEnvCache();
    const { createApp } = await import('../app.js');
    app = createApp() as unknown as Hono;
  });

  afterAll(() => {
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;
    if (prevClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = prevClientId;
  });

  it('роут выключен → 404 NOT_FOUND, до проверки токена не доходит', async () => {
    const res = await googleAuth(app);
    expect(res.status).toBe(404);
    expect((await json<ApiError>(res)).error.code).toBe('NOT_FOUND');
    expect(mockVerify).not.toHaveBeenCalled();
  });
});

describe.skipIf(!TEST_URL)('POST /auth/google (интеграция, verify замокан)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let app: Hono;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    const { resetEnvCache } = await import('../config/env.js');
    resetEnvCache();

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    const { createApp } = await import('../app.js');
    app = createApp() as unknown as Hono;
  });

  afterAll(async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await testDb.client.end();
  });

  beforeEach(async () => {
    mockVerify.mockReset();
    await truncateAll(testDb.db);
  });

  it('первый вход → 201, создаёт google-пользователя', async () => {
    mockVerify.mockResolvedValue(PROFILE);
    const res = await googleAuth(app);
    expect(res.status).toBe(201);
    const body = await json<AuthResponse>(res);
    expect(body.user.email).toBe('aizhan@example.kg');
    expect(body.user.displayName).toBe('Айжан');
    expect(body.accessToken).toBeTruthy();
  });

  it('повторный вход с тем же sub → 200 и тот же пользователь', async () => {
    mockVerify.mockResolvedValue(PROFILE);
    const first = await json<AuthResponse>(await googleAuth(app));
    const res = await googleAuth(app);
    expect(res.status).toBe(200);
    expect((await json<AuthResponse>(res)).user.id).toBe(first.user.id);
  });

  it('email уже зарегистрирован паролем → входит в существующий аккаунт', async () => {
    const reg = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: PROFILE.email,
        password: 'password-123',
        displayName: 'Айжан (email)',
      }),
    });
    const emailUser = await json<AuthResponse>(reg);

    mockVerify.mockResolvedValue(PROFILE);
    const res = await googleAuth(app);
    expect(res.status).toBe(200);
    expect((await json<AuthResponse>(res)).user.id).toBe(emailUser.user.id);
  });

  it('битый токен → 401 UNAUTHORIZED', async () => {
    mockVerify.mockRejectedValue(new Error('bad signature'));
    const res = await googleAuth(app);
    expect(res.status).toBe(401);
    expect((await json<ApiError>(res)).error.code).toBe('UNAUTHORIZED');
  });

  it('email у Google не подтверждён → 401', async () => {
    mockVerify.mockResolvedValue({ ...PROFILE, emailVerified: false });
    const res = await googleAuth(app);
    expect(res.status).toBe(401);
  });

  it('пустое тело → 422 VALIDATION', async () => {
    const res = await app.request('/api/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });
});

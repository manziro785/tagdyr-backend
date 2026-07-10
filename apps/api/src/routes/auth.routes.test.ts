import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type { AuthResponse, Me, ApiError } from '@tagdyr/schemas';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';

const json = <T>(res: Response): Promise<T> => res.json() as Promise<T>;

const TEST_URL = getTestDbUrl();

// Без тест-БД интеграционные тесты пропускаются (логика паролей покрыта юнитами).
describe.skipIf(!TEST_URL)('auth routes (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let app: Hono;

  const register = (body: unknown) =>
    app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const login = (body: unknown) =>
    app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    const { createApp } = await import('../app.js');
    app = createApp() as unknown as Hono;
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  it('register → 201 с токенами и профилем; email нормализуется', async () => {
    const res = await register({
      email: '  Manas@Example.COM ',
      password: 'password-123',
      displayName: 'Манас',
    });
    expect(res.status).toBe(201);
    const body = await json<AuthResponse>(res);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe('manas@example.com');
    expect(body.user.displayName).toBe('Манас');
  });

  it('повторная регистрация того же email → 409 CONFLICT', async () => {
    await register({ email: 'a@b.kg', password: 'password-123', displayName: 'A' });
    const res = await register({ email: 'A@B.KG', password: 'password-456', displayName: 'B' });
    expect(res.status).toBe(409);
    const body = await json<ApiError>(res);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('login с верным паролем → 200, access-токен открывает /me', async () => {
    await register({ email: 'a@b.kg', password: 'password-123', displayName: 'Айбек' });
    const res = await login({ email: 'a@b.kg', password: 'password-123' });
    expect(res.status).toBe(200);
    const body = await json<AuthResponse>(res);

    const me = await app.request('/api/v1/me', {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.status).toBe(200);
    expect((await json<Me>(me)).displayName).toBe('Айбек');
  });

  it('login: неверный пароль и несуществующий email дают одинаковый 401', async () => {
    await register({ email: 'a@b.kg', password: 'password-123', displayName: 'A' });

    const wrongPass = await login({ email: 'a@b.kg', password: 'wrong-password' });
    const noUser = await login({ email: 'ghost@b.kg', password: 'password-123' });

    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect((await json<ApiError>(wrongPass)).error.message).toBe(
      (await json<ApiError>(noUser)).error.message,
    );
  });

  it('register: короткий пароль → 422 VALIDATION', async () => {
    const res = await register({ email: 'a@b.kg', password: 'short', displayName: 'A' });
    expect(res.status).toBe(422);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Smoke-тест маршрутизации (без БД): проверяем, что /lives/compare не
 * перехватывается /lives/:id. Бьём без токена — ждём 401 от auth-middleware
 * (значит роут найден и дошёл до auth), а не 404 "route not found".
 */
describe('lives routing', () => {
  let app: ReturnType<typeof import('../app.js').createApp>;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgres://u:p@localhost:5432/tagdyr';
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';
    const { createApp } = await import('../app.js');
    app = createApp();
  });

  it('GET /lives/compare доходит до auth (401), не теряется в /:id', async () => {
    const res = await app.request('/api/v1/lives/compare?a=x&b=y');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /lives/:id тоже доходит до auth (401), маршруты не конфликтуют', async () => {
    const res = await app.request('/api/v1/lives/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).toBe(401);
  });

  it('полностью неизвестный путь вне роутеров → 404 в едином формате', async () => {
    const res = await app.request('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

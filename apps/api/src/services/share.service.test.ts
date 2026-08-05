import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser, completeBody } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

describe.skipIf(!TEST_URL)('share service (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let createShareLink: typeof import('./share.service.js').createShareLink;
  let getSharedLife: typeof import('./share.service.js').getSharedLife;
  let completeSeason: typeof import('./complete-season.service.js').completeSeason;
  let createLife: typeof import('./lives.service.js').createLife;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ createShareLink, getSharedLife } = await import('./share.service.js'));
    ({ completeSeason } = await import('./complete-season.service.js'));
    ({ createLife } = await import('./lives.service.js'));
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  it('создаёт токен и публичный срез; повторный вызов даёт тот же токен', async () => {
    const userId = await createUser(testDb.db, { displayName: 'Азамат' });
    const life = await createLife(userId, { slotIndex: 0, characterId: 'char_aibek', seed: 's' });

    const first = await createShareLink(userId, life.id);
    expect(first.token.length).toBeGreaterThanOrEqual(20);
    expect(first.payload.displayName).toBe('Азамат');
    expect(first.payload.characterId).toBe('char_aibek');
    expect(first.payload.endingId).toBeNull(); // жизнь не завершена

    const second = await createShareLink(userId, life.id);
    expect(second.token).toBe(first.token); // ссылка стабильна
  });

  it('чужая жизнь → forbidden', async () => {
    const owner = await createUser(testDb.db, { providerId: 'owner' });
    const other = await createUser(testDb.db, { providerId: 'other' });
    const life = await createLife(owner, { slotIndex: 0, characterId: 'char_aibek', seed: 's' });

    await expect(createShareLink(other, life.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('публичный доступ по токену без авторизации отдаёт тот же срез', async () => {
    const userId = await createUser(testDb.db, { displayName: 'Нур' });
    const life = await createLife(userId, { slotIndex: 0, characterId: 'char_aizhan', seed: 's' });
    await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 1,
      body: completeBody({ seed: 's' }),
      idempotencyKey: 'k1',
    });

    const { token } = await createShareLink(userId, life.id);
    const shared = await getSharedLife(token);

    expect(shared.lifeId).toBe(life.id);
    expect(shared.displayName).toBe('Нур');
    expect(shared.seasonsPlayed).toBe(1);
    expect(shared.lifeIndex).toBeGreaterThan(0);
    // безопасный срез: во витрине нет флагов/дневника/долгов
    expect(shared).not.toHaveProperty('flags');
    expect(shared).not.toHaveProperty('diary');
  });

  it('несуществующий токен → not found', async () => {
    await expect(getSharedLife('nope-nope-nope-nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

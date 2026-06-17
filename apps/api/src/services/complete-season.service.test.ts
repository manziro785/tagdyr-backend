import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser, completeBody } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

// Без тест-БД интеграционные тесты пропускаются (юнит-логика покрыта в engine).
describe.skipIf(!TEST_URL)('completeSeason (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let completeSeason: typeof import('./complete-season.service.js').completeSeason;
  let createLife: typeof import('./lives.service.js').createLife;
  let getLife: typeof import('./lives.service.js').getLife;

  beforeAll(async () => {
    // env должен быть выставлен до импорта db-синглтона
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ completeSeason } = await import('./complete-season.service.js'));
    ({ createLife, getLife } = await import('./lives.service.js'));
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  it('завершает сезон: пишет снапшот, скип времени, season_result, двигает сезон', async () => {
    const userId = await createUser(testDb.db);
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 'seed-abc',
    });

    const res = await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 1,
      body: completeBody(),
      idempotencyKey: 'key-1',
    });

    expect(res.snapshot.seasonNumber).toBe(1);
    expect(res.snapshot.diary).toHaveLength(2);
    // S1→S2 = 1 год: долг 20000 @ 14% → 22800
    expect(res.timeSkip.years).toBe(1);
    expect(res.timeSkip.debts[0]!.after).toBe(22800);
    expect(res.nextSeasonStartState?.seasonNumber).toBe(2);
    expect(res.seasonResult.lifeIndex).toBeGreaterThan(0);

    // life продвинулся к сезону 2
    const updated = await getLife(userId, life.id);
    expect(updated.currentSeason).toBe(2);
    expect(updated.debts[0]!.amount).toBe(22800);
  });

  it('идемпотентна по ключу: повторный сабмит не плодит снапшоты', async () => {
    const userId = await createUser(testDb.db);
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 'seed-abc',
    });

    const first = await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 1,
      body: completeBody(),
      idempotencyKey: 'same-key',
    });
    const second = await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 1,
      body: completeBody(),
      idempotencyKey: 'same-key',
    });

    expect(second.snapshot.id).toBe(first.snapshot.id);
    const after = await getLife(userId, life.id);
    expect(after.currentSeason).toBe(2); // не уехал в 3
  });

  it('IDOR: чужой userId → forbidden', async () => {
    const owner = await createUser(testDb.db);
    const attacker = await createUser(testDb.db, { providerId: 'attacker' });
    const life = await createLife(owner, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 's',
    });

    await expect(
      completeSeason({
        userId: attacker,
        lifeId: life.id,
        seasonNumber: 1,
        body: completeBody(),
        idempotencyKey: 'k',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('несовпадение номера сезона → conflict', async () => {
    const userId = await createUser(testDb.db);
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 's',
    });
    await expect(
      completeSeason({
        userId,
        lifeId: life.id,
        seasonNumber: 3,
        body: completeBody(),
        idempotencyKey: 'k',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

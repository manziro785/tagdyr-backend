import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser, completeBody } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

describe.skipIf(!TEST_URL)('rewindLife (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let completeSeason: typeof import('./complete-season.service.js').completeSeason;
  let rewindLife: typeof import('./rewind.service.js').rewindLife;
  let createLife: typeof import('./lives.service.js').createLife;
  let getLife: typeof import('./lives.service.js').getLife;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ completeSeason } = await import('./complete-season.service.js'));
    ({ rewindLife } = await import('./rewind.service.js'));
    ({ createLife, getLife } = await import('./lives.service.js'));
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  it('откатывает к концу сезона: удаляет поздние снапшоты, восстанавливает стейт', async () => {
    const userId = await createUser(testDb.db);
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 's',
    });

    // пройти сезоны 1 и 2
    await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 1,
      body: completeBody({ seed: 's', endState: { stats: { money: 1000, energy: 50, mood: 50, relationships: 50 }, flags: { season1: true }, debts: [] } }),
      idempotencyKey: 'k1',
    });
    await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 2,
      body: completeBody({ seed: 's', endState: { stats: { money: 5000, energy: 60, mood: 60, relationships: 60 }, flags: { season2: true }, debts: [] } }),
      idempotencyKey: 'k2',
    });

    let cur = await getLife(userId, life.id);
    expect(cur.currentSeason).toBe(3);

    // откат к концу сезона 1
    const rewound = await rewindLife({ userId, lifeId: life.id, toSeason: 1 });
    expect(rewound.currentSeason).toBe(2);
    // стейт восстановлен из снапшота сезона 1
    expect(rewound.flags['season1']).toBe(true);
    expect(rewound.flags['season2']).toBeUndefined();

    // снапшот сезона 2 удалён → можно снова пройти сезон 2 с тем же ключом
    cur = await getLife(userId, life.id);
    expect(cur.lastSnapshot?.seasonNumber).toBe(1);
  });

  it('откат к несуществующему сезону → conflict', async () => {
    const userId = await createUser(testDb.db);
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 's',
    });
    await expect(
      rewindLife({ userId, lifeId: life.id, toSeason: 2 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

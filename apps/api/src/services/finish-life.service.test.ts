import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser, completeBody } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

describe.skipIf(!TEST_URL)('finishLife (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let finishLife: typeof import('./finish-life.service.js').finishLife;
  let completeSeason: typeof import('./complete-season.service.js').completeSeason;
  let createLife: typeof import('./lives.service.js').createLife;
  let livesRepo: typeof import('../repositories/lives.repo.js').livesRepo;
  let collections: typeof import('./collections.service.js');

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ finishLife } = await import('./finish-life.service.js'));
    ({ completeSeason } = await import('./complete-season.service.js'));
    ({ createLife } = await import('./lives.service.js'));
    ({ livesRepo } = await import('../repositories/lives.repo.js'));
    collections = await import('./collections.service.js');
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  /** Создаёт жизнь и досрочно доводит её до конца 5-го сезона. */
  async function finishedLife(
    userId: string,
    endStats: { money: number; energy: number; mood: number; relationships: number },
    flags: Record<string, boolean | number> = {},
  ) {
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 'seed-final',
    });
    await livesRepo.update(testDb.db, life.id, { currentSeason: 5 });
    await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 5,
      body: completeBody({ endState: { stats: endStats, flags, debts: [] } }),
      idempotencyKey: 'final-key',
    });
    return life;
  }

  it('support-концовка: открывает концовку и разблокирует Марата', async () => {
    const userId = await createUser(testDb.db);
    const life = await finishedLife(
      userId,
      { money: 30_000, energy: 60, mood: 60, relationships: 85 },
      { familyFirst: true },
    );

    const res = await finishLife({ userId, lifeId: life.id });
    expect(res.ending.code).toBe('support');
    expect(res.newEnding).toBe(true);
    expect(res.unlockedCharacterIds).toContain('char_marat');
    expect(res.lifeIndex).toBeGreaterThan(0);

    const roster = await collections.getCharactersRoster(userId);
    const marat = roster.items.find((ch) => ch.id === 'char_marat');
    expect(marat?.unlocked).toBe(true);

    const gallery = await collections.getEndingsCollection(userId);
    expect(gallery.unlocked).toBe(1);
    expect(gallery.items.find((e) => e.code === 'support')?.unlockedAt).toBeTruthy();
  });

  it('идемпотентен: повторный finish возвращает ту же концовку без дублей', async () => {
    const userId = await createUser(testDb.db);
    const life = await finishedLife(userId, {
      money: 30_000,
      energy: 60,
      mood: 60,
      relationships: 50,
    });

    const first = await finishLife({ userId, lifeId: life.id });
    const second = await finishLife({ userId, lifeId: life.id });

    expect(first.ending.code).toBe(second.ending.code);
    expect(second.newEnding).toBe(false);
    expect(second.unlockedCharacterIds).toHaveLength(0);
  });

  it('незавершённая жизнь → conflict', async () => {
    const userId = await createUser(testDb.db);
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: 's',
    });
    await expect(finishLife({ userId, lifeId: life.id })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('коллекция карточек считает открытые по кодам из complete', async () => {
    const userId = await createUser(testDb.db);
    await finishedLife(userId, { money: 1000, energy: 50, mood: 50, relationships: 50 });

    // completeBody открывает карточку effective_rate
    const cards = await collections.getCardsCollection(userId);
    expect(cards.unlocked).toBe(1);
    expect(cards.items.find((c) => c.code === 'effective_rate')?.unlockedAt).toBeTruthy();
    expect(cards.total).toBeGreaterThanOrEqual(10);
  });
});

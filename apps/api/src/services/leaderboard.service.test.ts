import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser, completeBody } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

describe.skipIf(!TEST_URL)('leaderboard service (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let getLeaderboard: typeof import('./leaderboard.service.js').getLeaderboard;
  let completeSeason: typeof import('./complete-season.service.js').completeSeason;
  let createLife: typeof import('./lives.service.js').createLife;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ getLeaderboard } = await import('./leaderboard.service.js'));
    ({ completeSeason } = await import('./complete-season.service.js'));
    ({ createLife } = await import('./lives.service.js'));
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  /** Заводит юзера с одной жизнью, завершившей сезон 1 с заданными деньгами (→ разный индекс). */
  async function playerWithScore(providerId: string, money: number) {
    const userId = await createUser(testDb.db, { providerId, email: `${providerId}@e.co` });
    const life = await createLife(userId, {
      slotIndex: 0,
      characterId: 'char_aibek',
      seed: providerId,
    });
    await completeSeason({
      userId,
      lifeId: life.id,
      seasonNumber: 1,
      body: completeBody({
        seed: providerId,
        endState: {
          stats: { money, energy: 50, mood: 50, relationships: 50 },
          flags: {},
          debts: [],
        },
        unlockedCards: [],
      }),
      idempotencyKey: `${providerId}-s1`,
    });
    return { userId, lifeId: life.id };
  }

  it('ранжирует по индексу убыванию; me даёт ранг и перцентиль', async () => {
    const top = await playerWithScore('rich', 100_000);
    await playerWithScore('mid', 50_000);
    await playerWithScore('low', 1_000);

    const lb = await getLeaderboard({
      userId: top.userId,
      season: 1,
      window: 'all',
      limit: 20,
    });

    expect(lb.totalPlayers).toBe(3);
    expect(lb.entries).toHaveLength(3);
    expect(lb.entries[0]!.lifeId).toBe(top.lifeId); // богатый — первый
    expect(lb.entries[0]!.rank).toBe(1);
    expect(lb.entries[0]!.isMe).toBe(true);

    expect(lb.me).not.toBeNull();
    expect(lb.me!.rank).toBe(1);
    expect(lb.me!.percentile).toBe(67); // обошёл 2 из 3
    expect(lb.nextCursor).toBeNull();
  });

  it('курсорная пагинация выдаёт страницы без пропусков и дублей', async () => {
    // 5 игроков с разными индексами
    for (const [i, money] of [90_000, 70_000, 50_000, 30_000, 10_000].entries()) {
      await playerWithScore(`p${i}`, money);
    }
    const viewer = await createUser(testDb.db, { providerId: 'viewer' });

    const page1 = await getLeaderboard({ userId: viewer, season: 1, window: 'all', limit: 2 });
    expect(page1.entries.map((e) => e.rank)).toEqual([1, 2]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getLeaderboard({
      userId: viewer,
      season: 1,
      window: 'all',
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.entries.map((e) => e.rank)).toEqual([3, 4]);

    const page3 = await getLeaderboard({
      userId: viewer,
      season: 1,
      window: 'all',
      limit: 2,
      cursor: page2.nextCursor!,
    });
    expect(page3.entries.map((e) => e.rank)).toEqual([5]);
    expect(page3.nextCursor).toBeNull();

    // ни один lifeId не повторился между страницами
    const all = [...page1.entries, ...page2.entries, ...page3.entries].map((e) => e.lifeId);
    expect(new Set(all).size).toBe(5);
  });

  it('пустой сезон → нет участников, me=null', async () => {
    const viewer = await createUser(testDb.db, { providerId: 'v' });
    const lb = await getLeaderboard({ userId: viewer, season: 3, window: 'all', limit: 20 });
    expect(lb.totalPlayers).toBe(0);
    expect(lb.entries).toHaveLength(0);
    expect(lb.me).toBeNull();
  });
});

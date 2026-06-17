import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser, completeBody } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

describe.skipIf(!TEST_URL)('compareLives (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let compareLives: typeof import('./compare.service.js').compareLives;
  let completeSeason: typeof import('./complete-season.service.js').completeSeason;
  let createLife: typeof import('./lives.service.js').createLife;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ compareLives } = await import('./compare.service.js'));
    ({ completeSeason } = await import('./complete-season.service.js'));
    ({ createLife } = await import('./lives.service.js'));
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  it('сравнивает две жизни одного юзера: сезоны, дневники, индексы', async () => {
    const userId = await createUser(testDb.db);
    const a = await createLife(userId, { slotIndex: 0, characterId: 'char_aibek', seed: 'sa' });
    const b = await createLife(userId, { slotIndex: 1, characterId: 'char_aizhan', seed: 'sb' });

    await completeSeason({
      userId,
      lifeId: a.id,
      seasonNumber: 1,
      body: completeBody({ seed: 'sa', diary: ['A прожил сезон 1'] }),
      idempotencyKey: 'a1',
    });
    await completeSeason({
      userId,
      lifeId: b.id,
      seasonNumber: 1,
      body: completeBody({ seed: 'sb', diary: ['B прожил сезон 1'] }),
      idempotencyKey: 'b1',
    });

    const res = await compareLives({ userId, aId: a.id, bId: b.id });

    expect(res.a.id).toBe(a.id);
    expect(res.b.id).toBe(b.id);
    expect(res.a.characterId).toBe('char_aibek');
    expect(res.b.characterId).toBe('char_aizhan');
    expect(res.a.seasons).toHaveLength(1);
    expect(res.a.seasons[0]!.diary).toEqual(['A прожил сезон 1']);
    expect(res.a.seasons[0]!.lifeIndex).toBeGreaterThan(0);
    expect(res.b.seasons[0]!.diary).toEqual(['B прожил сезон 1']);
  });

  it('сравнение с самой собой → validation', async () => {
    const userId = await createUser(testDb.db);
    const a = await createLife(userId, { slotIndex: 0, characterId: 'char_aibek', seed: 's' });
    await expect(compareLives({ userId, aId: a.id, bId: a.id })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('IDOR: чужая жизнь во втором аргументе → forbidden', async () => {
    const owner = await createUser(testDb.db);
    const other = await createUser(testDb.db, { providerId: 'other' });
    const mine = await createLife(owner, { slotIndex: 0, characterId: 'char_aibek', seed: 's' });
    const theirs = await createLife(other, { slotIndex: 0, characterId: 'char_aizhan', seed: 's' });

    await expect(
      compareLives({ userId: owner, aId: mine.id, bId: theirs.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

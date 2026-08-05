import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestDbUrl, createTestDb, applyMigrations, truncateAll } from '../test/db.js';
import { createUser } from '../test/factories.js';

const TEST_URL = getTestDbUrl();

describe.skipIf(!TEST_URL)('dilemma service (integration)', () => {
  let testDb: ReturnType<typeof createTestDb>;
  let getTodayDilemma: typeof import('./dilemma.service.js').getTodayDilemma;
  let answerTodayDilemma: typeof import('./dilemma.service.js').answerTodayDilemma;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL!;
    process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_at_least_16_chars';
    process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_at_least_16_chars';

    testDb = createTestDb(TEST_URL!);
    await applyMigrations(testDb.db);

    ({ getTodayDilemma, answerTodayDilemma } = await import('./dilemma.service.js'));
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  beforeEach(async () => {
    await truncateAll(testDb.db);
  });

  it('до ответа распределение скрыто, myChoice=null', async () => {
    const userId = await createUser(testDb.db);
    const d = await getTodayDilemma(userId);

    expect(d.prompt.length).toBeGreaterThan(0);
    expect(d.options.length).toBeGreaterThanOrEqual(2);
    expect(d.myChoice).toBeNull();
    expect(d.distribution).toBeNull();
    expect(d.totalVotes).toBe(0);
  });

  it('после ответа возвращается распределение в процентах', async () => {
    const userId = await createUser(testDb.db);
    const res = await answerTodayDilemma(userId, 0);

    expect(res.myChoice).toBe(0);
    expect(res.totalVotes).toBe(1);
    expect(res.distribution).not.toBeNull();
    const opt0 = res.distribution!.find((o) => o.index === 0)!;
    expect(opt0.votes).toBe(1);
    expect(opt0.percent).toBe(100);
  });

  it('повторный ответ не меняет выбор и не плодит голоса (uniq)', async () => {
    const userId = await createUser(testDb.db);
    await answerTodayDilemma(userId, 0);
    const again = await answerTodayDilemma(userId, 1);

    expect(again.myChoice).toBe(0); // первый выбор сохраняется
    expect(again.totalVotes).toBe(1);
  });

  it('choiceIndex вне диапазона вариантов → validation', async () => {
    const userId = await createUser(testDb.db);
    await expect(answerTodayDilemma(userId, 9)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('считает распределение по нескольким пользователям', async () => {
    const u1 = await createUser(testDb.db, { providerId: 'u1' });
    const u2 = await createUser(testDb.db, { providerId: 'u2' });
    const u3 = await createUser(testDb.db, { providerId: 'u3' });

    await answerTodayDilemma(u1, 0);
    await answerTodayDilemma(u2, 0);
    const res = await answerTodayDilemma(u3, 1);

    expect(res.totalVotes).toBe(3);
    expect(res.distribution!.find((o) => o.index === 0)!.percent).toBe(67);
    expect(res.distribution!.find((o) => o.index === 1)!.percent).toBe(33);
  });
});

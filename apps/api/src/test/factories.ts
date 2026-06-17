import type { createTestDb } from './db.js';
import { users } from '../db/schema.js';
import type { CompleteSeasonRequest } from '@tagdyr/schemas';

type TestDb = ReturnType<typeof createTestDb>['db'];

export async function createUser(
  db: TestDb,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<string> {
  const rows = await db
    .insert(users)
    .values({
      provider: 'email',
      providerId: `test-${Math.random().toString(36).slice(2)}`,
      email: 'test@example.com',
      displayName: 'Test User',
      ...overrides,
    })
    .returning();
  return rows[0]!.id;
}

/** Готовое тело complete с разумными дефолтами. */
export function completeBody(over: Partial<CompleteSeasonRequest> = {}): CompleteSeasonRequest {
  return {
    seed: 'seed-abc',
    endState: {
      stats: { money: 12000, energy: 40, mood: 70, relationships: 55 },
      flags: { hasJob: true },
      debts: [{ amount: 20000, rate: 0.14, sinceSeason: 1 }],
    },
    keyDecisions: [{ code: 'brother_loan', choice: 'gave_full' }],
    diary: ['Дал брату 5000', 'Нашёл подработку'],
    unlockedCards: ['effective_rate'],
    unlockedEndingHint: null,
    choiceLog: [],
    ...over,
  };
}

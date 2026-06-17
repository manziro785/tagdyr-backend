import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import { sslFor } from '../db/ssl.js';

/**
 * Подключение к тестовой БД. Требует TEST_DATABASE_URL — ОТДЕЛЬНУЮ базу,
 * не прод: между тестами таблицы очищаются TRUNCATE.
 */
export function getTestDbUrl(): string | null {
  return process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? null;
}

export function createTestDb(url: string) {
  const client = postgres(url, { max: 1, ssl: sslFor(url) });
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function applyMigrations(db: ReturnType<typeof createTestDb>['db']): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' });
}

/** Очистка всех игровых таблиц (CASCADE снимает FK-зависимости). */
export async function truncateAll(
  db: ReturnType<typeof createTestDb>['db'],
): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      dilemma_answers, daily_dilemmas, share_tokens,
      user_knowledge_cards, user_endings, user_characters,
      season_results, life_snapshots, lives, users
    RESTART IDENTITY CASCADE
  `);
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadEnv } from '../config/env.js';
import { sslFor } from './ssl.js';
import * as schema from './schema.js';

const env = loadEnv();

/**
 * postgres-js клиент. Render external Postgres использует самоподписанный CA,
 * поэтому ssl: { rejectUnauthorized: false } (ssl:'require' даёт ECONNRESET).
 * Для локального Postgres без TLS — ssl отключаем.
 * prepare: false — безопаснее для пулеров/transaction mode.
 */
const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'test' ? 1 : 10,
  prepare: false,
  ssl: sslFor(env.DATABASE_URL),
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;

/** Корректное закрытие соединений (graceful shutdown / тесты). */
export async function closeDb(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}

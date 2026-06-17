import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { loadEnv } from '../config/env.js';
import { sslFor } from './ssl.js';

/** Применение миграций. Запуск: pnpm db:migrate (tsx + .env). */
async function main(): Promise<void> {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1, ssl: sslFor(env.DATABASE_URL) });
  const db = drizzle(sql);
  console.log('Running migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

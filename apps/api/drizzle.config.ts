import { defineConfig } from 'drizzle-kit';

// drizzle-kit читает DATABASE_URL из окружения. Локально подгружается через
// `node --env-file=.env` или dotenv в скрипте миграций.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});

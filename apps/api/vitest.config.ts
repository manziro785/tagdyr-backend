import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // workspace-пакеты резолвим из исходников (условие "development" в exports)
    conditions: ['development'],
  },
  test: {
    environment: 'node',
    // Интеграционные тесты бьют в одну общую БД и делают TRUNCATE — гоняем
    // последовательно в одном процессе, иначе параллельные TRUNCATE дают deadlock.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    // Render — удалённая БД (большой RTT); даём запас по времени.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

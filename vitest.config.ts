import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Резолвим workspace-пакеты из исходников (через условие "development" в exports),
  // чтобы тесты не требовали предварительной сборки .d.ts.
  resolve: {
    conditions: ['development'],
  },
  test: {
    environment: 'node',
  },
});

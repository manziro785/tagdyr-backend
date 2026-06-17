import { DEFAULT_CONFIG, type EngineConfig } from '@tagdyr/engine';
import { loadEnv } from './env.js';

/** Конфиг движка с переопределением ставок из env (§10: ставки не в коде). */
export function getEngineConfig(): EngineConfig {
  const env = loadEnv();
  return {
    ...DEFAULT_CONFIG,
    timeSkip: {
      savingsRate: env.SAVINGS_RATE ?? DEFAULT_CONFIG.timeSkip.savingsRate,
      defaultDebtRate: env.DEFAULT_DEBT_RATE ?? DEFAULT_CONFIG.timeSkip.defaultDebtRate,
    },
  };
}

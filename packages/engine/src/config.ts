/**
 * Конфиг игровой логики. Все ставки/веса/лимиты — здесь, не хардкодом по коду (§10).
 * На сервере значения переопределяются из env (см. apps/api), движок принимает
 * конфиг параметром — поэтому остаётся чистым и детерминированным.
 */

import type { Stats } from '@tagdyr/schemas';

export interface TimeSkipConfig {
  /** Годовая ставка на накопления (money>0), если у долга не задана своя. */
  savingsRate: number;
  /** Дефолтная годовая ставка по долгу, если в самом долге rate не указан. */
  defaultDebtRate: number;
}

export interface LifeIndexWeights {
  money: number;
  energy: number;
  mood: number;
  relationships: number;
  /** Множитель за число собранных карточек знаний. */
  cardBonus: number;
}

export interface LifeIndexConfig {
  weights: LifeIndexWeights;
  /**
   * Опорная сумма для логарифмической нормировки money → 0..100.
   * money == moneyReference даёт ~100 баллов по деньгам.
   */
  moneyReference: number;
}

export interface EngineConfig {
  timeSkip: TimeSkipConfig;
  lifeIndex: LifeIndexConfig;
  /** Таблица переходов: сколько лет проходит между сезоном n и n+1. Индекс 0 → S1→S2. */
  seasonYearGaps: readonly number[];
}

export const DEFAULT_CONFIG: EngineConfig = {
  timeSkip: {
    savingsRate: 0.08,
    defaultDebtRate: 0.14,
  },
  lifeIndex: {
    weights: {
      money: 0.35,
      energy: 0.15,
      mood: 0.2,
      relationships: 0.2,
      cardBonus: 0.5,
    },
    moneyReference: 1_000_000,
  },
  // S1→S2 ≈ 1, S2→S3 ≈ 1, S3→S4 ≈ 3, S4→S5 ≈ 5 (диапазоны из дизайн-дока, §6.2).
  seasonYearGaps: [1, 1, 3, 5],
};

/** Сколько лет проходит между завершённым сезоном n и следующим. */
export function yearsBetweenSeasons(
  completedSeason: number,
  config: EngineConfig = DEFAULT_CONFIG,
): number {
  const gap = config.seasonYearGaps[completedSeason - 1];
  return gap ?? 0;
}

/** Диапазоны стат для санити-чека (§9, базовый уровень). */
export const STAT_BOUNDS: Record<keyof Pick<Stats, 'energy' | 'mood' | 'relationships'>, [number, number]> =
  {
    energy: [0, 100],
    mood: [0, 100],
    relationships: [0, 100],
  };

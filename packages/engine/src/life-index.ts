import type { Stats } from '@tagdyr/schemas';
import { DEFAULT_CONFIG, type EngineConfig } from './config.js';

/**
 * Логарифмическая нормировка денег к 0..100. При money <= 0 → 0.
 * При money == moneyReference → ~100. Лог-шкала: миллионеры не ломают рейтинг,
 * прирост с 10k→100k весит так же, как 100k→1M.
 */
export function normalizeMoney(money: number, moneyReference: number): number {
  if (money <= 0) return 0;
  const ratio = Math.log10(money + 1) / Math.log10(moneyReference + 1);
  return Math.max(0, Math.min(100, ratio * 100));
}

export interface LifeIndexInput {
  stats: Stats;
  /** Число собранных карточек знаний. */
  cardsCount: number;
  /** Бонус за архетип концовки (0 на промежуточных сезонах). */
  endingBonus?: number;
}

/**
 * Индекс жизни (§6.3): взвешенный балл вместо сортировки по деньгам.
 * Считается на сервере при complete/finish → пишется в season_results.life_index.
 */
export function computeLifeIndex(
  input: LifeIndexInput,
  config: EngineConfig = DEFAULT_CONFIG,
): number {
  const { weights, moneyReference } = config.lifeIndex;
  const { stats, cardsCount, endingBonus = 0 } = input;

  const moneyScore = normalizeMoney(stats.money, moneyReference);

  const index =
    weights.money * moneyScore +
    weights.energy * stats.energy +
    weights.mood * stats.mood +
    weights.relationships * stats.relationships +
    weights.cardBonus * cardsCount +
    endingBonus;

  // округляем до 2 знаков — лидерборд не нуждается в плавающем хвосте
  return Math.round(index * 100) / 100;
}

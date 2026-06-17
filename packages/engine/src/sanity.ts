import type { Stats, SeasonEndState } from '@tagdyr/schemas';
import { STAT_BOUNDS } from './config.js';

export interface SanityIssue {
  field: string;
  message: string;
}

/**
 * Базовый санити-чек состояния на конец сезона (§9, базовый уровень).
 * Проверяет диапазоны 0..100 для энергии/настроения/отношений и неотрицательность
 * долгов. Не пытается верифицировать «честность» прохождения — это делает реплей (§9).
 */
export function checkEndStateSanity(endState: SeasonEndState): SanityIssue[] {
  const issues: SanityIssue[] = [];

  for (const key of ['energy', 'mood', 'relationships'] as const) {
    const [min, max] = STAT_BOUNDS[key];
    const value = endState.stats[key as keyof Stats] as number;
    if (value < min || value > max) {
      issues.push({ field: `stats.${key}`, message: `out of bounds [${min}, ${max}]: ${value}` });
    }
  }

  endState.debts.forEach((debt, i) => {
    if (debt.amount < 0) {
      issues.push({ field: `debts[${i}].amount`, message: `negative debt: ${debt.amount}` });
    }
  });

  return issues;
}

/**
 * Опциональная проверка дельты между двумя сезонами — статы не должны прыгать
 * за разумные пределы за один сезон. Порог конфигурируемый.
 */
export function checkStatDelta(
  prev: Stats,
  next: Stats,
  maxDelta = 100,
): SanityIssue[] {
  const issues: SanityIssue[] = [];
  for (const key of ['energy', 'mood', 'relationships'] as const) {
    const delta = Math.abs(next[key] - prev[key]);
    if (delta > maxDelta) {
      issues.push({ field: `stats.${key}`, message: `delta ${delta} > ${maxDelta}` });
    }
  }
  return issues;
}

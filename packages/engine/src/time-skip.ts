import type { Debt, TimeSkip, DebtProjection, SavingsProjection } from '@tagdyr/schemas';
import { DEFAULT_CONFIG, yearsBetweenSeasons, type EngineConfig } from './config.js';

/** Деньги — целые единицы валюты; банковское округление не нужно, обычное round. */
function roundMoney(value: number): number {
  return Math.round(value);
}

/**
 * Сложный процент по годам: возвращает значение на конец каждого года.
 * perYear[i] = principal * (1 + rate)^(i+1), округлённое. Длина == years.
 */
function compoundPerYear(principal: number, rate: number, years: number): number[] {
  const out: number[] = [];
  let value = principal;
  for (let i = 0; i < years; i += 1) {
    value = value * (1 + rate);
    out.push(roundMoney(value));
  }
  return out;
}

export interface ApplyTimeSkipInput {
  /** Сезон, который только что завершён (1..5). Определяет, сколько лет пройдёт. */
  completedSeason: number;
  /** Накопления = положительная часть money. */
  savings: number;
  debts: Debt[];
}

export interface ApplyTimeSkipResult {
  /** Накопления после начисления процентов (округлённые). */
  savingsAfter: number;
  /** Долги после капитализации процентов. */
  debtsAfter: Debt[];
  /** Раскладка для честной визуализации на экране межсезонья. */
  timeSkip: TimeSkip;
}

/**
 * Скип времени между сезонами (§6.2). Детерминированная функция:
 * накопления и каждый долг растут сложным процентом за `years` лет.
 */
export function applyTimeSkip(
  input: ApplyTimeSkipInput,
  config: EngineConfig = DEFAULT_CONFIG,
): ApplyTimeSkipResult {
  const years = yearsBetweenSeasons(input.completedSeason, config);
  const { savingsRate, defaultDebtRate } = config.timeSkip;

  // ── накопления ──────────────────────────────────────────────────────────
  let savingsProjection: SavingsProjection | null = null;
  let savingsAfter = input.savings;
  if (input.savings > 0 && years > 0) {
    const perYear = compoundPerYear(input.savings, savingsRate, years);
    savingsAfter = perYear[perYear.length - 1] ?? input.savings;
    savingsProjection = {
      before: roundMoney(input.savings),
      rate: savingsRate,
      after: savingsAfter,
      perYear,
    };
  } else {
    savingsAfter = roundMoney(input.savings);
  }

  // ── долги ──────────────────────────────────────────────────────────────
  const debtProjections: DebtProjection[] = [];
  const debtsAfter: Debt[] = input.debts.map((debt) => {
    const rate = debt.rate > 0 ? debt.rate : defaultDebtRate;
    if (years === 0 || debt.amount <= 0) {
      const amount = roundMoney(debt.amount);
      debtProjections.push({ before: amount, rate, after: amount, perYear: [] });
      return { ...debt, amount, rate };
    }
    const perYear = compoundPerYear(debt.amount, rate, years);
    const after = perYear[perYear.length - 1] ?? debt.amount;
    debtProjections.push({ before: roundMoney(debt.amount), rate, after, perYear });
    return { ...debt, amount: after, rate };
  });

  return {
    savingsAfter,
    debtsAfter,
    timeSkip: {
      years,
      savings: savingsProjection,
      debts: debtProjections,
    },
  };
}

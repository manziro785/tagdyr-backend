import { describe, it, expect } from 'vitest';
import { applyTimeSkip } from './time-skip.js';
import { DEFAULT_CONFIG, type EngineConfig } from './config.js';

describe('applyTimeSkip — долги', () => {
  it('воспроизводит пример из ТЗ: 20000 под 14% за 4 года ≈ 33778', () => {
    // S3→S4 в дефолтной таблице = 3 года, поэтому задаём конфиг с 4 годами явно,
    // чтобы сверить ровно пример §6.2.
    const cfg: EngineConfig = {
      ...DEFAULT_CONFIG,
      seasonYearGaps: [1, 1, 4, 5],
    };
    const res = applyTimeSkip(
      {
        completedSeason: 3,
        savings: 0,
        debts: [{ amount: 20000, rate: 0.14, sinceSeason: 1 }],
      },
      cfg,
    );

    expect(res.timeSkip.years).toBe(4);
    const debt = res.timeSkip.debts[0]!;
    expect(debt.before).toBe(20000);
    expect(debt.perYear).toEqual([22800, 25992, 29631, 33779]);
    expect(debt.after).toBe(33779);
    expect(res.debtsAfter[0]!.amount).toBe(33779);
  });

  it('использует defaultDebtRate, если у долга ставка 0', () => {
    const res = applyTimeSkip({
      completedSeason: 1, // 1 год
      savings: 0,
      debts: [{ amount: 1000, rate: 0, sinceSeason: 1 }],
    });
    const debt = res.timeSkip.debts[0]!;
    expect(debt.rate).toBe(DEFAULT_CONFIG.timeSkip.defaultDebtRate);
    expect(debt.after).toBe(1140); // 1000 * 1.14
  });

  it('при 0 лет долг не меняется', () => {
    const cfg: EngineConfig = { ...DEFAULT_CONFIG, seasonYearGaps: [0, 1, 3, 5] };
    const res = applyTimeSkip(
      { completedSeason: 1, savings: 0, debts: [{ amount: 5000, rate: 0.1, sinceSeason: 1 }] },
      cfg,
    );
    expect(res.timeSkip.years).toBe(0);
    expect(res.debtsAfter[0]!.amount).toBe(5000);
    expect(res.timeSkip.debts[0]!.perYear).toEqual([]);
  });
});

describe('applyTimeSkip — накопления', () => {
  it('начисляет процент на положительные накопления', () => {
    const res = applyTimeSkip({
      completedSeason: 1, // 1 год, savingsRate 0.08
      savings: 10000,
      debts: [],
    });
    expect(res.savingsAfter).toBe(10800);
    expect(res.timeSkip.savings).not.toBeNull();
    expect(res.timeSkip.savings!.perYear).toEqual([10800]);
  });

  it('не начисляет на нулевые/отрицательные накопления', () => {
    const res = applyTimeSkip({ completedSeason: 1, savings: 0, debts: [] });
    expect(res.timeSkip.savings).toBeNull();
    expect(res.savingsAfter).toBe(0);
  });

  it('сложный процент за несколько лет (накопления)', () => {
    const cfg: EngineConfig = { ...DEFAULT_CONFIG, seasonYearGaps: [3, 1, 3, 5] };
    const res = applyTimeSkip({ completedSeason: 1, savings: 1000, debts: [] }, cfg);
    // 1000 → 1080 → 1166 → 1260 (округления каждый год)
    expect(res.timeSkip.savings!.perYear).toEqual([1080, 1166, 1260]);
    expect(res.savingsAfter).toBe(1260);
  });
});

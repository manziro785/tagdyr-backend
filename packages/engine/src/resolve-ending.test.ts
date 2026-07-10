import { describe, it, expect } from 'vitest';
import { resolveEnding } from './resolve-ending.js';
import type { Stats } from '@tagdyr/schemas';

const okStats: Stats = { money: 50_000, energy: 60, mood: 60, relationships: 50 };

describe('resolveEnding', () => {
  it('долг больше денег → debt_trap, перекрывает бизнес', () => {
    const code = resolveEnding({
      stats: { ...okStats, money: 10_000 },
      flags: { hasBusiness: true },
      debts: [{ amount: 40_000, rate: 0.14, sinceSeason: 2 }],
    });
    expect(code).toBe('debt_trap');
  });

  it('маленький долг не считается ямой', () => {
    const code = resolveEnding({
      stats: okStats,
      flags: {},
      debts: [{ amount: 10_000, rate: 0.14, sinceSeason: 4 }],
    });
    expect(code).not.toBe('debt_trap');
  });

  it('пустая батарейка → burnout', () => {
    expect(
      resolveEnding({ stats: { ...okStats, energy: 15 }, flags: {}, debts: [] }),
    ).toBe('burnout');
    expect(
      resolveEnding({ stats: { ...okStats, mood: 10 }, flags: {}, debts: [] }),
    ).toBe('burnout');
  });

  it('бизнес → entrepreneur', () => {
    expect(resolveEnding({ stats: okStats, flags: { hasBusiness: true }, debts: [] })).toBe(
      'entrepreneur',
    );
  });

  it('уехал и не вернулся → wanderer; вернулся — нет', () => {
    expect(resolveEnding({ stats: okStats, flags: { wentAbroad: true }, debts: [] })).toBe(
      'wanderer',
    );
    expect(
      resolveEnding({
        stats: okStats,
        flags: { wentAbroad: true, returnedHome: true },
        debts: [],
      }),
    ).not.toBe('wanderer');
  });

  it('отношения + семья → support', () => {
    expect(
      resolveEnding({
        stats: { ...okStats, relationships: 80 },
        flags: { familyFirst: true },
        debts: [],
      }),
    ).toBe('support');
  });

  it('без флагов и крайностей → steady', () => {
    expect(resolveEnding({ stats: okStats, flags: {}, debts: [] })).toBe('steady');
  });

  it('числовые флаги не считаются булевым true', () => {
    expect(resolveEnding({ stats: okStats, flags: { hasBusiness: 1 }, debts: [] })).toBe('steady');
  });
});

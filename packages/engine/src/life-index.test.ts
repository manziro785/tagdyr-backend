import { describe, it, expect } from 'vitest';
import { computeLifeIndex, normalizeMoney } from './life-index.js';
import { DEFAULT_CONFIG } from './config.js';

describe('normalizeMoney', () => {
  it('money <= 0 → 0', () => {
    expect(normalizeMoney(0, 1_000_000)).toBe(0);
    expect(normalizeMoney(-5000, 1_000_000)).toBe(0);
  });

  it('money == reference → ~100', () => {
    expect(normalizeMoney(1_000_000, 1_000_000)).toBeCloseTo(100, 5);
  });

  it('логарифмическая: монотонно растёт, но насыщается', () => {
    const a = normalizeMoney(10_000, 1_000_000);
    const b = normalizeMoney(100_000, 1_000_000);
    const c = normalizeMoney(1_000_000, 1_000_000);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    // прирост 10k→100k и 100k→1M на лог-шкале сопоставим (миллионеры не ломают рейтинг)
    expect(Math.abs((b - a) - (c - b))).toBeLessThan(5);
  });

  it('сверх reference не превышает 100', () => {
    expect(normalizeMoney(100_000_000, 1_000_000)).toBeLessThanOrEqual(100);
  });
});

describe('computeLifeIndex', () => {
  const baseStats = { money: 0, energy: 50, mood: 50, relationships: 50 };

  it('считается по весам из конфига', () => {
    const idx = computeLifeIndex({ stats: baseStats, cardsCount: 0 });
    const w = DEFAULT_CONFIG.lifeIndex.weights;
    const expected = w.energy * 50 + w.mood * 50 + w.relationships * 50;
    expect(idx).toBeCloseTo(Math.round(expected * 100) / 100, 5);
  });

  it('карточки повышают индекс', () => {
    const without = computeLifeIndex({ stats: baseStats, cardsCount: 0 });
    const withCards = computeLifeIndex({ stats: baseStats, cardsCount: 4 });
    expect(withCards).toBeGreaterThan(without);
    expect(withCards - without).toBeCloseTo(DEFAULT_CONFIG.lifeIndex.weights.cardBonus * 4, 5);
  });

  it('endingBonus добавляется как есть', () => {
    const a = computeLifeIndex({ stats: baseStats, cardsCount: 0 });
    const b = computeLifeIndex({ stats: baseStats, cardsCount: 0, endingBonus: 10 });
    expect(b - a).toBeCloseTo(10, 5);
  });

  it('детерминирован: одинаковый вход → одинаковый выход', () => {
    const input = { stats: { money: 50000, energy: 70, mood: 80, relationships: 60 }, cardsCount: 3 };
    expect(computeLifeIndex(input)).toBe(computeLifeIndex(input));
  });
});

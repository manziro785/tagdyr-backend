import { describe, it, expect } from 'vitest';
import { createRng, hashSeed } from './rng.js';

describe('seeded RNG — детерминизм', () => {
  it('один seed → одинаковая последовательность (основа реплея)', () => {
    const a = createRng('tagdyr-seed-1');
    const b = createRng('tagdyr-seed-1');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('разные seed → разные последовательности', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    expect(a.next()).not.toBe(b.next());
  });

  it('hashSeed детерминирован и беззнаковый', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).toBeGreaterThanOrEqual(0);
  });
});

describe('seeded RNG — диапазоны', () => {
  it('next() всегда в [0, 1)', () => {
    const rng = createRng('range');
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() в границах включительно', () => {
    const rng = createRng('int');
    for (let i = 0; i < 1000; i += 1) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('int(n, n) всегда n', () => {
    const rng = createRng('single');
    expect(rng.int(7, 7)).toBe(7);
  });

  it('int бросает при max < min', () => {
    const rng = createRng('bad');
    expect(() => rng.int(10, 5)).toThrow();
  });

  it('pick из пустого массива бросает', () => {
    const rng = createRng('empty');
    expect(() => rng.pick([])).toThrow();
  });

  it('chance(0) == false, chance(1) == true', () => {
    const rng = createRng('chance');
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });
});

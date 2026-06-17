/**
 * Детерминированный seeded RNG. Один и тот же seed → одна и та же последовательность
 * на клиенте и сервере. Это основа реплей-античита (§9): сервер прогоняет тот же
 * движок по тому же seed и сверяет финальный стейт.
 *
 * Алгоритм: cyrb53 (хэш строки → 32-битный сид) + mulberry32 (PRNG).
 * Оба — компактные, быстрые, без зависимостей, хорошо распределены для игровых нужд.
 */

/** Хэш строки в беззнаковое 32-битное число (на основе cyrb53, усечённый). */
export function hashSeed(seed: string): number {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export interface Rng {
  /** Следующее число в [0, 1). */
  next(): number;
  /** Целое в [min, max] включительно. */
  int(min: number, max: number): number;
  /** Случайный элемент массива. Бросает на пустом массиве. */
  pick<T>(items: readonly T[]): T;
  /** true с вероятностью p (0..1). */
  chance(p: number): boolean;
  /** Текущее внутреннее состояние — для сериализации/возобновления. */
  getState(): number;
}

/** mulberry32 — быстрый детерминированный PRNG с 32-битным состоянием. */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (max < min) throw new Error(`int(${min}, ${max}): max < min`);
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick() from empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    chance(p) {
      return next() < p;
    },
    getState() {
      return state;
    },
  };
}

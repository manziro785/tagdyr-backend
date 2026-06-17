import { z } from 'zod';

/**
 * Базовые статы жизни. Диапазоны:
 *  - money: рубли/сомы, может быть отрицательным концептуально, но для нормировки
 *    в индексе берём положительную часть. Накопления под процент в скипе времени
 *    (§6.2) считаются от положительного money — в ТЗ упомянут "savings", которого
 *    в модели нет; трактуем его как money>0. См. tagdyr-open-questions.
 *  - energy / mood / relationships: шкала 0..100.
 */
export const statsSchema = z.object({
  money: z.number().finite(),
  energy: z.number().min(0).max(100),
  mood: z.number().min(0).max(100),
  relationships: z.number().min(0).max(100),
});
export type Stats = z.infer<typeof statsSchema>;

/** Флаги — произвольные булевы/числовые отметки, выставляемые событиями. */
export const flagsSchema = z.record(z.string(), z.union([z.boolean(), z.number()]));
export type Flags = z.infer<typeof flagsSchema>;

/** Один долг. rate — годовая ставка (0.14 = 14%). */
export const debtSchema = z.object({
  amount: z.number().nonnegative(),
  rate: z.number().min(0).max(5),
  sinceSeason: z.number().int().min(1).max(5),
});
export type Debt = z.infer<typeof debtSchema>;

export const debtsSchema = z.array(debtSchema);
export type Debts = z.infer<typeof debtsSchema>;

/**
 * Полный «живой» LifeState — то, что лежит в lives и читается быстро.
 * История по сезонам — в снапшотах.
 */
export const lifeStateSchema = z.object({
  characterId: z.string().min(1),
  currentSeason: z.number().int().min(1).max(5),
  age: z.number().int().min(0).max(120),
  stats: statsSchema,
  flags: flagsSchema,
  debts: debtsSchema,
});
export type LifeState = z.infer<typeof lifeStateSchema>;

export const lifeStatusSchema = z.enum(['active', 'finished', 'archived']);
export type LifeStatus = z.infer<typeof lifeStatusSchema>;

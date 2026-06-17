import { z } from 'zod';
import { statsSchema } from './life-state.js';
import { keyDecisionSchema } from './snapshot.js';

/** Срез одного сезона для экрана сравнения. */
export const compareSeasonSchema = z.object({
  seasonNumber: z.number().int().min(1).max(5),
  age: z.number().int(),
  stats: statsSchema,
  diary: z.array(z.string()),
  keyDecisions: z.array(keyDecisionSchema),
  seasonOutcome: z.string(),
  /** Индекс жизни за этот сезон (из season_results); null если ещё не посчитан. */
  lifeIndex: z.number().nullable(),
});
export type CompareSeason = z.infer<typeof compareSeasonSchema>;

/** Одна жизнь в сравнении: шапка + сезоны. */
export const compareLifeSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string(),
  status: z.enum(['active', 'finished', 'archived']),
  currentSeason: z.number().int(),
  currentStats: statsSchema,
  /** Концовка появится в фазе 4 (finish); сейчас null. */
  endingCode: z.string().nullable(),
  seasons: z.array(compareSeasonSchema),
});
export type CompareLife = z.infer<typeof compareLifeSchema>;

/** Ответ GET /lives/compare?a=&b= */
export const compareResponseSchema = z.object({
  a: compareLifeSchema,
  b: compareLifeSchema,
});
export type CompareResponse = z.infer<typeof compareResponseSchema>;

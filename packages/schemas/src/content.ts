import { z } from 'zod';
import { statsSchema } from './life-state.js';

/** Персонаж — стартовая точка жизни. */
export const characterSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().min(0).max(120),
  description: z.string(),
  startStats: statsSchema,
  /** Условие разблокировки в свободной форме (код концовки/флаг). null = доступен сразу. */
  unlockCondition: z.string().nullable().default(null),
  isUnlockable: z.boolean().default(false),
});
export type Character = z.infer<typeof characterSchema>;

export const knowledgeCardCategorySchema = z.enum([
  'finance',
  'relationships',
  'health',
  'career',
  'life',
]);
export type KnowledgeCardCategory = z.infer<typeof knowledgeCardCategorySchema>;

/** Карточка знаний — собирается по ходу прохождения. */
export const knowledgeCardSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  category: knowledgeCardCategorySchema,
  body: z.string(),
  /** В каком сезоне открывается. */
  season: z.number().int().min(1).max(5),
});
export type KnowledgeCard = z.infer<typeof knowledgeCardSchema>;

/** Концовка (архетип итога жизни). */
export const endingSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  archetype: z.string().min(1),
  description: z.string(),
});
export type Ending = z.infer<typeof endingSchema>;

/** Манифест версии контента — для кэш-бастинга на клиенте. */
export const contentVersionSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().datetime(),
});
export type ContentVersion = z.infer<typeof contentVersionSchema>;

import { z } from 'zod';
import { statsSchema, flagsSchema, debtsSchema, lifeStatusSchema } from './life-state.js';
import { keyDecisionSchema, choiceLogSchema, lifeSnapshotSchema } from './snapshot.js';
import { timeSkipSchema } from './time-skip.js';

// ── /lives ──────────────────────────────────────────────────────────────────

/** POST /lives — начать новую жизнь. */
export const createLifeRequestSchema = z.object({
  slotIndex: z.number().int().min(0).max(2),
  characterId: z.string().min(1),
  seed: z.string().min(1),
});
export type CreateLifeRequest = z.infer<typeof createLifeRequestSchema>;

/** Краткий LifeState для списка слотов (GET /lives). */
export const lifeSummarySchema = z.object({
  id: z.string().uuid(),
  slotIndex: z.number().int().min(0).max(2),
  characterId: z.string(),
  status: lifeStatusSchema,
  currentSeason: z.number().int(),
  age: z.number().int(),
  stats: statsSchema,
  updatedAt: z.string().datetime(),
});
export type LifeSummary = z.infer<typeof lifeSummarySchema>;

/** Полный ответ GET /lives/:id. */
export const lifeDetailSchema = lifeSummarySchema.extend({
  flags: flagsSchema,
  debts: debtsSchema,
  seed: z.string(),
  lastSnapshot: lifeSnapshotSchema.nullable(),
});
export type LifeDetail = z.infer<typeof lifeDetailSchema>;

// ── season complete ───────────────────────────────────────────────────────────

/** Состояние на конец сезона, посчитанное клиентом. */
export const seasonEndStateSchema = z.object({
  stats: statsSchema,
  flags: flagsSchema,
  debts: debtsSchema,
});
export type SeasonEndState = z.infer<typeof seasonEndStateSchema>;

/** POST /lives/:id/seasons/:n/complete — тело запроса. */
export const completeSeasonRequestSchema = z.object({
  seed: z.string().min(1),
  endState: seasonEndStateSchema,
  keyDecisions: z.array(keyDecisionSchema).default([]),
  diary: z.array(z.string()).default([]),
  unlockedCards: z.array(z.string()).default([]),
  unlockedEndingHint: z.string().nullable().default(null),
  /** Для реплей-проверки (§9). На MVP может быть пустым. */
  choiceLog: choiceLogSchema.default([]),
});
export type CompleteSeasonRequest = z.infer<typeof completeSeasonRequestSchema>;

/** Стартовое состояние следующего сезона (с применённым скипом времени). */
export const nextSeasonStartStateSchema = z.object({
  seasonNumber: z.number().int().min(1).max(5),
  age: z.number().int(),
  stats: statsSchema,
  flags: flagsSchema,
  debts: debtsSchema,
});
export type NextSeasonStartState = z.infer<typeof nextSeasonStartStateSchema>;

export const seasonResultSchema = z.object({
  id: z.string().uuid(),
  seasonNumber: z.number().int(),
  lifeIndex: z.number(),
});
export type SeasonResult = z.infer<typeof seasonResultSchema>;

export const completeSeasonResponseSchema = z.object({
  snapshot: lifeSnapshotSchema,
  nextSeasonStartState: nextSeasonStartStateSchema.nullable(),
  timeSkip: timeSkipSchema,
  seasonResult: seasonResultSchema,
});
export type CompleteSeasonResponse = z.infer<typeof completeSeasonResponseSchema>;

// ── rewind ─────────────────────────────────────────────────────────────────

/** POST /lives/:id/rewind — «переписать судьбу». */
export const rewindRequestSchema = z.object({
  toSeason: z.number().int().min(1).max(5),
});
export type RewindRequest = z.infer<typeof rewindRequestSchema>;

// ── /me ───────────────────────────────────────────────────────────────────

export const localeSchema = z.enum(['ru', 'ky']);
export type Locale = z.infer<typeof localeSchema>;

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  locale: localeSchema,
});
export type Me = z.infer<typeof meSchema>;

export const updateMeRequestSchema = z
  .object({
    displayName: z.string().min(1).max(60).optional(),
    locale: localeSchema.optional(),
  })
  .refine((v) => v.displayName !== undefined || v.locale !== undefined, {
    message: 'At least one field must be provided',
  });
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

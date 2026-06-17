import { z } from 'zod';
import { statsSchema, flagsSchema, debtsSchema } from './life-state.js';

/** Ключевая развилка сезона: код события + выбранный вариант. */
export const keyDecisionSchema = z.object({
  code: z.string().min(1),
  choice: z.string().min(1),
});
export type KeyDecision = z.infer<typeof keyDecisionSchema>;

/**
 * Запись лога выборов для реплей-проверки (§9). Минимально достаточно кода события
 * и индекса/кода выбора + хода, чтобы сервер прогнал тот же движок по тому же seed.
 */
export const choiceLogEntrySchema = z.object({
  turn: z.number().int().nonnegative(),
  eventCode: z.string().min(1),
  choice: z.union([z.string(), z.number().int()]),
});
export type ChoiceLogEntry = z.infer<typeof choiceLogEntrySchema>;

export const choiceLogSchema = z.array(choiceLogEntrySchema);
export type ChoiceLog = z.infer<typeof choiceLogSchema>;

/** Снапшот на конец сезона — для отката «переписать судьбу» и дневника. */
export const lifeSnapshotSchema = z.object({
  id: z.string().uuid(),
  lifeId: z.string().uuid(),
  seasonNumber: z.number().int().min(1).max(5),
  age: z.number().int().min(0).max(120),
  stats: statsSchema,
  flags: flagsSchema,
  debts: debtsSchema,
  keyDecisions: z.array(keyDecisionSchema),
  diary: z.array(z.string()),
  seasonOutcome: z.string(),
  /** AI-эпилог, кэшируется здесь; null пока не сгенерирован. */
  epilogue: z.string().nullable(),
  seed: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type LifeSnapshot = z.infer<typeof lifeSnapshotSchema>;

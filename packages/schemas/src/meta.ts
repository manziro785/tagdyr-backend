import { z } from 'zod';
import { statsSchema } from './life-state.js';

/**
 * Мета и социалка (§5.4, фаза 5): дилемма дня, лидерборд, share.
 */

// ── дилемма дня ───────────────────────────────────────────────────────────────

export const dilemmaOptionStatSchema = z.object({
  index: z.number().int().min(0),
  text: z.string(),
  /** Доля выбравших, 0..100. Показываем только после ответа. */
  percent: z.number().min(0).max(100),
  votes: z.number().int().min(0),
});
export type DilemmaOptionStat = z.infer<typeof dilemmaOptionStatSchema>;

export const dilemmaTodaySchema = z.object({
  id: z.string().uuid(),
  /** Дата в UTC, YYYY-MM-DD — по ней фронт понимает, что наступил новый день. */
  date: z.string(),
  prompt: z.string(),
  options: z.array(z.string()),
  /** Индекс выбранного варианта, null — ещё не отвечал. */
  myChoice: z.number().int().min(0).nullable(),
  totalVotes: z.number().int().min(0),
  /** Распределение отдаём только тем, кто уже ответил (иначе — подсказка). */
  distribution: z.array(dilemmaOptionStatSchema).nullable(),
});
export type DilemmaToday = z.infer<typeof dilemmaTodaySchema>;

export const dilemmaAnswerRequestSchema = z.object({
  choiceIndex: z.number().int().min(0).max(9),
});
export type DilemmaAnswerRequest = z.infer<typeof dilemmaAnswerRequestSchema>;

// ── лидерборд ─────────────────────────────────────────────────────────────────

export const leaderboardWindowSchema = z.enum(['week', 'month', 'all']);
export type LeaderboardWindow = z.infer<typeof leaderboardWindowSchema>;

export const leaderboardQuerySchema = z.object({
  season: z.coerce.number().int().min(1).max(5),
  window: leaderboardWindowSchema.default('week'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Курсорная пагинация (§10): «lifeIndex|id» последней строки предыдущей страницы. */
  cursor: z.string().optional(),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  lifeId: z.string().uuid(),
  displayName: z.string(),
  characterId: z.string(),
  lifeIndex: z.number(),
  /** Своя строка подсвечивается на фронте. */
  isMe: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardMeSchema = z.object({
  lifeId: z.string().uuid(),
  rank: z.number().int().min(1),
  lifeIndex: z.number(),
  /** Процент участников, которых обошёл пользователь (0..100). */
  percentile: z.number().min(0).max(100),
});
export type LeaderboardMe = z.infer<typeof leaderboardMeSchema>;

export const leaderboardSchema = z.object({
  season: z.number().int(),
  window: leaderboardWindowSchema,
  totalPlayers: z.number().int().min(0),
  entries: z.array(leaderboardEntrySchema),
  /** Лучший результат пользователя в этом сезоне; null — ещё не играл. */
  me: leaderboardMeSchema.nullable(),
  /** Курсор следующей страницы; null — страниц больше нет. */
  nextCursor: z.string().nullable(),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

// ── share ─────────────────────────────────────────────────────────────────────

/**
 * Публичный срез жизни (§11): ни email, ни флагов, ни дневника —
 * только то, что не стыдно отдать анониму по ссылке.
 */
export const sharePayloadSchema = z.object({
  lifeId: z.string().uuid(),
  displayName: z.string(),
  characterId: z.string(),
  status: z.enum(['active', 'finished', 'archived']),
  seasonsPlayed: z.number().int().min(0),
  age: z.number().int(),
  stats: statsSchema,
  lifeIndex: z.number(),
  endingId: z.string().nullable(),
  endingTitle: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type SharePayload = z.infer<typeof sharePayloadSchema>;

/** GET /lives/:id/share — владелец получает токен и тот же срез, что увидит получатель. */
export const shareLinkSchema = z.object({
  token: z.string(),
  payload: sharePayloadSchema,
});
export type ShareLink = z.infer<typeof shareLinkSchema>;

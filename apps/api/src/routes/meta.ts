import { Hono } from 'hono';
import { dilemmaAnswerRequestSchema, leaderboardQuerySchema } from '@tagdyr/schemas';
import type { AppEnv } from '../http/context.js';
import { authMiddleware, requireUserId } from '../http/middleware/auth.js';
import { rateLimit } from '../http/middleware/rate-limit.js';
import { parseBody, parseInput } from '../http/validate.js';
import { answerTodayDilemma, getTodayDilemma } from '../services/dilemma.service.js';
import { getLeaderboard } from '../services/leaderboard.service.js';

/**
 * Приватная мета (§5.4, фаза 5): дилемма дня + лидерборд. Два отдельных роутера,
 * смонтированных на конкретные префиксы (/dilemma, /leaderboard) — чтобы
 * auth-middleware не перехватывал неизвестные пути под /api/v1 и они честно
 * доходили до общего 404.
 */

// ── /dilemma ──────────────────────────────────────────────────────────────────

export const dilemmaRoutes = new Hono<AppEnv>();

dilemmaRoutes.use('*', authMiddleware());

// GET /dilemma/today — дилемма дня + мой ответ + распределение (если ответил)
dilemmaRoutes.get('/today', async (c) => {
  const userId = requireUserId(c);
  return c.json(await getTodayDilemma(userId));
});

// POST /dilemma/today/answer — записать голос (лимит: 10 запросов/мин на юзера)
dilemmaRoutes.post('/today/answer', rateLimit({ limit: 10, windowMs: 60_000 }), async (c) => {
  const userId = requireUserId(c);
  const body = await parseBody(c, dilemmaAnswerRequestSchema);
  return c.json(await answerTodayDilemma(userId, body.choiceIndex));
});

// ── /leaderboard ──────────────────────────────────────────────────────────────

export const leaderboardRoutes = new Hono<AppEnv>();

leaderboardRoutes.use('*', authMiddleware());

// GET /leaderboard?season=&window=&limit=&cursor= — рейтинг + ранг/перцентиль
leaderboardRoutes.get('/', async (c) => {
  const userId = requireUserId(c);
  const q = parseInput(c.req.query(), leaderboardQuerySchema);
  return c.json(
    await getLeaderboard({
      userId,
      season: q.season,
      window: q.window,
      limit: q.limit,
      cursor: q.cursor,
    }),
  );
});

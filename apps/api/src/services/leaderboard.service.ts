import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm';
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardWindow,
} from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { lives, seasonResults, users } from '../db/schema.js';
import { validation } from '../http/errors.js';

export interface LeaderboardParams {
  userId: string;
  season: number;
  window: LeaderboardWindow;
  limit: number;
  cursor?: string;
}

/** Начало окна: неделя/месяц назад от «сейчас», либо эпоха для 'all'. */
function windowStart(window: LeaderboardWindow): Date {
  const now = Date.now();
  if (window === 'week') return new Date(now - 7 * 86_400_000);
  if (window === 'month') return new Date(now - 30 * 86_400_000);
  return new Date(0);
}

/**
 * Курсор — «lifeIndex|lifeId» последней строки страницы. Ранжируем по
 * (lifeIndex DESC, lifeId ASC), поэтому «дальше» = строго меньше по этому
 * лексикографическому порядку. lifeId в ключе делает порядок тотальным —
 * строки с равным индексом не теряются и не дублируются между страницами.
 */
function encodeCursor(lifeIndex: number, lifeId: string): string {
  return `${lifeIndex}|${lifeId}`;
}

function decodeCursor(cursor: string): { lifeIndex: number; lifeId: string } {
  const sep = cursor.lastIndexOf('|');
  const lifeIndex = Number(cursor.slice(0, sep));
  const lifeId = cursor.slice(sep + 1);
  if (sep < 0 || !Number.isFinite(lifeIndex) || !lifeId) {
    throw validation('Invalid cursor');
  }
  return { lifeIndex, lifeId };
}

export async function getLeaderboard(params: LeaderboardParams): Promise<Leaderboard> {
  const { userId, season, window, limit } = params;
  const since = windowStart(window);

  // Отбор в окне: результаты этого сезона не старше границы окна.
  const inWindow = and(eq(seasonResults.seasonNumber, season), gte(seasonResults.createdAt, since));

  // Всего игроков (по жизням) в окне — знаменатель перцентиля и число участников.
  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(seasonResults)
    .where(inWindow);
  const totalPlayers = totalRows[0]?.count ?? 0;

  // Страница рейтинга: seasonResults × lives × users, порядок (index desc, lifeId asc).
  const baseWhere = params.cursor
    ? and(inWindow, cursorPredicate(decodeCursor(params.cursor)))
    : inWindow;

  const rows = await db
    .select({
      lifeId: seasonResults.lifeId,
      lifeIndex: seasonResults.lifeIndex,
      ownerId: lives.userId,
      characterId: lives.characterId,
      displayName: users.displayName,
    })
    .from(seasonResults)
    .innerJoin(lives, eq(lives.id, seasonResults.lifeId))
    .innerJoin(users, eq(users.id, lives.userId))
    .where(baseWhere)
    .orderBy(desc(seasonResults.lifeIndex), seasonResults.lifeId)
    .limit(limit + 1); // +1 строка — «есть ли следующая страница»

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Ранг первой строки страницы. Без курсора — 1. С курсором: сам курсор стоит
  // на ранге countAbove+1, а эта страница начинается СРАЗУ ЗА ним → countAbove+2.
  const startRank = params.cursor
    ? (await countAbove(season, since, decodeCursor(params.cursor))) + 2
    : 1;

  const entries: LeaderboardEntry[] = page.map((r, i) => ({
    rank: startRank + i,
    lifeId: r.lifeId,
    displayName: r.displayName,
    characterId: r.characterId,
    lifeIndex: Number(r.lifeIndex),
    isMe: r.ownerId === userId,
  }));

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(Number(page[page.length - 1]!.lifeIndex), page[page.length - 1]!.lifeId)
      : null;

  const me = await computeMe(userId, season, since, totalPlayers);

  return { season, window, totalPlayers, entries, me, nextCursor };
}

/** Строки «дальше по порядку» относительно курсора (index desc, id asc). */
function cursorPredicate(cursor: { lifeIndex: number; lifeId: string }) {
  const idx = cursor.lifeIndex.toString();
  return or(
    lt(seasonResults.lifeIndex, idx),
    and(eq(seasonResults.lifeIndex, idx), sql`${seasonResults.lifeId} > ${cursor.lifeId}`),
  );
}

/** Сколько результатов сезона в окне стоят строго выше данной точки порядка. */
async function countAbove(
  season: number,
  since: Date,
  point: { lifeIndex: number; lifeId: string },
): Promise<number> {
  const idx = point.lifeIndex.toString();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(seasonResults)
    .where(
      and(
        eq(seasonResults.seasonNumber, season),
        gte(seasonResults.createdAt, since),
        or(
          sql`${seasonResults.lifeIndex} > ${idx}`,
          and(eq(seasonResults.lifeIndex, idx), sql`${seasonResults.lifeId} < ${point.lifeId}`),
        ),
      ),
    );
  return rows[0]?.count ?? 0;
}

/** Лучший результат пользователя в сезоне: ранг + перцентиль. */
async function computeMe(
  userId: string,
  season: number,
  since: Date,
  totalPlayers: number,
): Promise<Leaderboard['me']> {
  const inWindow = and(eq(seasonResults.seasonNumber, season), gte(seasonResults.createdAt, since));

  const best = await db
    .select({ lifeId: seasonResults.lifeId, lifeIndex: seasonResults.lifeIndex })
    .from(seasonResults)
    .where(and(inWindow, eq(seasonResults.userId, userId)))
    .orderBy(desc(seasonResults.lifeIndex), seasonResults.lifeId)
    .limit(1);

  if (best.length === 0 || totalPlayers === 0) return null;
  const mine = best[0]!;

  const rank = (await countAbove(season, since, {
    lifeIndex: Number(mine.lifeIndex),
    lifeId: mine.lifeId,
  })) + 1;

  // перцентиль = доля участников, которых обошёл (позади тебя / всего)
  const percentile = Math.round(((totalPlayers - rank) / totalPlayers) * 100);

  return {
    lifeId: mine.lifeId,
    rank,
    lifeIndex: Number(mine.lifeIndex),
    percentile: Math.max(0, Math.min(100, percentile)),
  };
}

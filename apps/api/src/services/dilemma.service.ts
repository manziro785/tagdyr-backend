import { and, eq, sql } from 'drizzle-orm';
import { dilemmaForDate } from '@tagdyr/content';
import type { DilemmaToday, DilemmaOptionStat } from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { dailyDilemmas, dilemmaAnswers } from '../db/schema.js';
import { validation } from '../http/errors.js';
import type { DB } from '../db/client.js';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

/** Сегодня в UTC как YYYY-MM-DD — граница дня общая для всех часовых поясов. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Строка дилеммы за дату. Контент детерминирован (dilemmaForDate), но нам нужен
 * реальный row с id, чтобы ответы ссылались по FK. Создаём лениво и идемпотентно:
 * onConflictDoNothing по уникальному date + повторный select снимают гонку двух
 * первых запросов за день.
 */
async function ensureTodayRow(exec: Executor, date: string) {
  const content = dilemmaForDate(date);
  await exec
    .insert(dailyDilemmas)
    .values({ date, prompt: content.prompt, options: content.options })
    .onConflictDoNothing({ target: dailyDilemmas.date });

  const rows = await exec
    .select()
    .from(dailyDilemmas)
    .where(eq(dailyDilemmas.date, date))
    .limit(1);
  return rows[0]!;
}

/** Подсчёт голосов по вариантам одним запросом (group by choice_index). */
async function tally(
  exec: Executor,
  dilemmaId: string,
  options: string[],
): Promise<{ total: number; distribution: DilemmaOptionStat[] }> {
  const rows = await exec
    .select({
      choiceIndex: dilemmaAnswers.choiceIndex,
      count: sql<number>`count(*)::int`,
    })
    .from(dilemmaAnswers)
    .where(eq(dilemmaAnswers.dilemmaId, dilemmaId))
    .groupBy(dilemmaAnswers.choiceIndex);

  const votesByIndex = new Map(rows.map((r) => [r.choiceIndex, r.count]));
  const total = rows.reduce((s, r) => s + r.count, 0);

  const distribution: DilemmaOptionStat[] = options.map((text, index) => {
    const votes = votesByIndex.get(index) ?? 0;
    return {
      index,
      text,
      votes,
      percent: total > 0 ? Math.round((votes / total) * 100) : 0,
    };
  });
  return { total, distribution };
}

/** GET /dilemma/today — дилемма + мой ответ + распределение (только если ответил). */
export async function getTodayDilemma(userId: string): Promise<DilemmaToday> {
  const date = todayIso();
  const row = await ensureTodayRow(db, date);

  const mine = await db
    .select({ choiceIndex: dilemmaAnswers.choiceIndex })
    .from(dilemmaAnswers)
    .where(and(eq(dilemmaAnswers.dilemmaId, row.id), eq(dilemmaAnswers.userId, userId)))
    .limit(1);
  const myChoice = mine[0]?.choiceIndex ?? null;

  const { total, distribution } = await tally(db, row.id, row.options);

  return {
    id: row.id,
    date,
    prompt: row.prompt,
    options: row.options,
    myChoice,
    totalVotes: total,
    // распределение — только ответившим, иначе это подсказка «как проголосовали»
    distribution: myChoice === null ? null : distribution,
  };
}

/** POST /dilemma/today/answer — записать голос, вернуть свежее распределение. */
export async function answerTodayDilemma(
  userId: string,
  choiceIndex: number,
): Promise<DilemmaToday> {
  const date = todayIso();

  return db.transaction(async (tx) => {
    const row = await ensureTodayRow(tx, date);

    if (choiceIndex >= row.options.length) {
      throw validation(`choiceIndex out of range (0..${row.options.length - 1})`);
    }

    // один ответ на пользователя в день; повторный сабмит не меняет выбор (uniq).
    await tx
      .insert(dilemmaAnswers)
      .values({ dilemmaId: row.id, userId, choiceIndex })
      .onConflictDoNothing({ target: [dilemmaAnswers.dilemmaId, dilemmaAnswers.userId] });

    const mine = await tx
      .select({ choiceIndex: dilemmaAnswers.choiceIndex })
      .from(dilemmaAnswers)
      .where(and(eq(dilemmaAnswers.dilemmaId, row.id), eq(dilemmaAnswers.userId, userId)))
      .limit(1);

    const { total, distribution } = await tally(tx, row.id, row.options);

    return {
      id: row.id,
      date,
      prompt: row.prompt,
      options: row.options,
      myChoice: mine[0]?.choiceIndex ?? choiceIndex,
      totalVotes: total,
      distribution,
    };
  });
}

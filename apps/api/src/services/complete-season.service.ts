import { eq, sql } from 'drizzle-orm';
import {
  applyTimeSkip,
  computeLifeIndex,
  checkEndStateSanity,
  yearsBetweenSeasons,
} from '@tagdyr/engine';
import type {
  CompleteSeasonRequest,
  CompleteSeasonResponse,
  NextSeasonStartState,
} from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { seasonResults, userKnowledgeCards } from '../db/schema.js';
import { livesRepo } from '../repositories/lives.repo.js';
import { toLifeSnapshot } from '../mappers/life.mapper.js';
import { conflict, forbidden, notFound, validation } from '../http/errors.js';
import { getEngineConfig } from '../config/engine-config.js';

const MAX_SEASON = 5;

export interface CompleteSeasonParams {
  userId: string;
  lifeId: string;
  seasonNumber: number;
  body: CompleteSeasonRequest;
  /** Idempotency-Key из заголовка; если нет — используем seed (§6.1.2 + §10). */
  idempotencyKey: string;
}

/**
 * Завершение сезона (§6.1) — самый ответственный эндпоинт. Всё в одной транзакции:
 *  1. владение, 2. идемпотентность, 3. валидация + проверка номера сезона,
 *  4. (фаза 6) реплей, 5. снапшот, 6. фиксация карточек, 7. скип времени,
 *  8. обновление lives, 9. season_results, 10. ответ с раскладкой скипа.
 */
export async function completeSeason(
  params: CompleteSeasonParams,
): Promise<CompleteSeasonResponse> {
  const { userId, lifeId, seasonNumber, body, idempotencyKey } = params;
  const cfg = getEngineConfig();

  return db.transaction(async (tx) => {
    // 1. владение
    const life = await livesRepo.findById(tx, lifeId);
    if (!life) throw notFound('Life not found');
    if (life.userId !== userId) throw forbidden('Not your life');

    // 2. идемпотентность — повторный сабмит того же ключа возвращает прежний результат
    const existing = await livesRepo.snapshotByKey(tx, lifeId, idempotencyKey);
    if (existing) {
      const result = await tx
        .select()
        .from(seasonResults)
        .where(eq(seasonResults.lifeId, lifeId))
        .orderBy(seasonResults.seasonNumber)
        .limit(MAX_SEASON);
      const sr = result.find((r) => r.seasonNumber === existing.seasonNumber);
      return buildResponseFromExisting(existing, sr, cfg);
    }

    // 3. валидация состояния и номера сезона
    if (life.status !== 'active') throw conflict('Life is not active');
    if (seasonNumber !== life.currentSeason) {
      throw conflict(`Season mismatch: expected ${life.currentSeason}, got ${seasonNumber}`);
    }
    const sanityIssues = checkEndStateSanity(body.endState);
    if (sanityIssues.length > 0) {
      throw validation('End state failed sanity check', sanityIssues);
    }

    // 4. (фаза 6) реплей-проверка по choiceLog + seed — пропускаем на MVP

    // 5. снапшот конца сезона
    const seasonOutcome = deriveSeasonOutcome(body);
    const snapshotRow = await livesRepo.insertSnapshot(tx, {
      lifeId,
      seasonNumber,
      age: life.age, // возраст на конец завершённого сезона (до скипа времени)
      stats: body.endState.stats,
      flags: body.endState.flags,
      debts: body.endState.debts,
      keyDecisions: body.keyDecisions,
      diary: body.diary,
      seasonOutcome,
      epilogue: null,
      seed: body.seed,
      idempotencyKey,
    });

    // 6. фиксация коллекций — карточки знаний (upsert без дублей)
    if (body.unlockedCards.length > 0) {
      await tx
        .insert(userKnowledgeCards)
        .values(
          body.unlockedCards.map((cardId) => ({ userId, cardId, lifeId })),
        )
        .onConflictDoNothing();
    }

    // 7. скип времени (сложный процент за годы между сезонами)
    const skip = applyTimeSkip(
      {
        completedSeason: seasonNumber,
        savings: Math.max(0, body.endState.stats.money),
        debts: body.endState.debts,
      },
      cfg,
    );

    const isFinalSeason = seasonNumber >= MAX_SEASON;
    const years = yearsBetweenSeasons(seasonNumber, cfg);

    // деньги после скипа: накопления растут, долги растут отдельно (хранятся в debts)
    const nextStats = {
      ...body.endState.stats,
      money: skip.savingsAfter,
    };

    // 8. обновление lives
    const cardsCount = await countUserCards(tx, userId);
    if (isFinalSeason) {
      await livesRepo.update(tx, lifeId, {
        status: 'finished',
        stats: nextStats,
        flags: body.endState.flags,
        debts: skip.debtsAfter,
        age: life.age + years,
        seed: body.seed,
      });
    } else {
      await livesRepo.update(tx, lifeId, {
        currentSeason: seasonNumber + 1,
        stats: nextStats,
        flags: body.endState.flags,
        debts: skip.debtsAfter,
        age: life.age + years,
        seed: body.seed,
      });
    }

    // 9. season_results — индекс этого сезона для лидерборда (upsert: переигровка обновляет)
    const lifeIndex = computeLifeIndex(
      { stats: body.endState.stats, cardsCount },
      cfg,
    );
    const srRows = await tx
      .insert(seasonResults)
      .values({ lifeId, userId, seasonNumber, lifeIndex: lifeIndex.toString() })
      .onConflictDoUpdate({
        target: [seasonResults.lifeId, seasonResults.seasonNumber],
        set: { lifeIndex: lifeIndex.toString(), createdAt: new Date() },
      })
      .returning();
    const sr = srRows[0]!;

    // 10. ответ
    const nextSeasonStartState: NextSeasonStartState | null = isFinalSeason
      ? null
      : {
          seasonNumber: seasonNumber + 1,
          age: life.age + years,
          stats: nextStats,
          flags: body.endState.flags,
          debts: skip.debtsAfter,
        };

    return {
      snapshot: toLifeSnapshot(snapshotRow),
      nextSeasonStartState,
      timeSkip: skip.timeSkip,
      seasonResult: {
        id: sr.id,
        seasonNumber: sr.seasonNumber,
        lifeIndex: Number(sr.lifeIndex),
      },
    };
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function deriveSeasonOutcome(body: CompleteSeasonRequest): string {
  // промежуточный итог («кем входишь в след. этап»). На MVP — короткая сводка.
  const job = body.endState.flags['hasJob'] ? 'с работой' : 'без работы';
  const debtTotal = body.endState.debts.reduce((s, d) => s + d.amount, 0);
  const debtPart = debtTotal > 0 ? `, долг ${Math.round(debtTotal)}` : ', без долгов';
  return `Входишь в следующий этап ${job}${debtPart}`;
}

async function countUserCards(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
): Promise<number> {
  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(userKnowledgeCards)
    .where(eq(userKnowledgeCards.userId, userId));
  return rows[0]?.count ?? 0;
}

function buildResponseFromExisting(
  existing: Awaited<ReturnType<typeof livesRepo.snapshotByKey>>,
  sr: typeof seasonResults.$inferSelect | undefined,
  cfg: ReturnType<typeof getEngineConfig>,
): CompleteSeasonResponse {
  const snap = existing!;
  const skip = applyTimeSkip(
    {
      completedSeason: snap.seasonNumber,
      savings: Math.max(0, snap.stats.money),
      debts: snap.debts,
    },
    cfg,
  );
  const isFinal = snap.seasonNumber >= MAX_SEASON;
  const years = yearsBetweenSeasons(snap.seasonNumber, cfg);
  return {
    snapshot: toLifeSnapshot(snap),
    nextSeasonStartState: isFinal
      ? null
      : {
          seasonNumber: snap.seasonNumber + 1,
          // снапшот хранит возраст на конец сезона; старт следующего = +годы перехода
          age: snap.age + years,
          stats: { ...snap.stats, money: skip.savingsAfter },
          flags: snap.flags,
          debts: skip.debtsAfter,
        },
    timeSkip: skip.timeSkip,
    seasonResult: {
      id: sr?.id ?? snap.id,
      seasonNumber: snap.seasonNumber,
      lifeIndex: sr ? Number(sr.lifeIndex) : 0,
    },
  };
}

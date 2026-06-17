import { and, eq, gt } from 'drizzle-orm';
import { yearsBetweenSeasons } from '@tagdyr/engine';
import { db } from '../db/client.js';
import { lifeSnapshots, seasonResults } from '../db/schema.js';
import { livesRepo } from '../repositories/lives.repo.js';
import { toLifeDetail } from '../mappers/life.mapper.js';
import { conflict, forbidden, notFound } from '../http/errors.js';
import { getEngineConfig } from '../config/engine-config.js';
import type { LifeDetail } from '@tagdyr/schemas';

export interface RewindParams {
  userId: string;
  lifeId: string;
  toSeason: number;
}

/**
 * «Переписать судьбу» (§5.1): откат к концу сезона toSeason.
 * Удаляет снапшоты и результаты ПОСЛЕ toSeason, восстанавливает LifeState
 * из снапшота toSeason, ставит current_season = toSeason + 1. Всё в транзакции.
 */
export async function rewindLife(params: RewindParams): Promise<LifeDetail> {
  const { userId, lifeId, toSeason } = params;

  return db.transaction(async (tx) => {
    const life = await livesRepo.findById(tx, lifeId);
    if (!life) throw notFound('Life not found');
    if (life.userId !== userId) throw forbidden('Not your life');

    // снапшот целевого сезона должен существовать
    const targetRows = await tx
      .select()
      .from(lifeSnapshots)
      .where(and(eq(lifeSnapshots.lifeId, lifeId), eq(lifeSnapshots.seasonNumber, toSeason)))
      .limit(1);
    const target = targetRows[0];
    if (!target) {
      throw conflict(`No snapshot for season ${toSeason} to rewind to`);
    }

    // удалить всё, что после toSeason
    await tx
      .delete(lifeSnapshots)
      .where(and(eq(lifeSnapshots.lifeId, lifeId), gt(lifeSnapshots.seasonNumber, toSeason)));
    await tx
      .delete(seasonResults)
      .where(and(eq(seasonResults.lifeId, lifeId), gt(seasonResults.seasonNumber, toSeason)));

    // откатить LifeState к началу следующего сезона: возраст = конец toSeason + годы перехода
    const years = yearsBetweenSeasons(toSeason, getEngineConfig());
    const updated = await livesRepo.update(tx, lifeId, {
      status: 'active',
      currentSeason: toSeason + 1,
      age: target.age + years,
      stats: target.stats,
      flags: target.flags,
      debts: target.debts,
      seed: target.seed,
    });

    return toLifeDetail(updated, target);
  });
}

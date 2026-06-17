import type { CompareResponse, CompareLife, CompareSeason } from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { livesRepo } from '../repositories/lives.repo.js';
import { forbidden, notFound, validation } from '../http/errors.js';
import type { LifeRow, LifeSnapshotRow, SeasonResultRow } from '../db/schema.js';

export interface CompareParams {
  userId: string;
  aId: string;
  bId: string;
}

/**
 * Данные двух жизней для экрана сравнения (§5.1, фаза 3).
 * Проверяет владение ОБЕИМИ жизнями (IDOR на каждую).
 */
export async function compareLives(params: CompareParams): Promise<CompareResponse> {
  const { userId, aId, bId } = params;
  if (aId === bId) throw validation('Cannot compare a life with itself');

  const [a, b] = await Promise.all([
    buildCompareLife(userId, aId),
    buildCompareLife(userId, bId),
  ]);
  return { a, b };
}

async function buildCompareLife(userId: string, lifeId: string): Promise<CompareLife> {
  const life = await livesRepo.findById(db, lifeId);
  if (!life) throw notFound(`Life not found: ${lifeId}`);
  if (life.userId !== userId) throw forbidden('Not your life');

  const [snapshots, results] = await Promise.all([
    livesRepo.allSnapshots(db, lifeId),
    livesRepo.allResults(db, lifeId),
  ]);

  const indexBySeason = new Map<number, number>(
    results.map((r: SeasonResultRow) => [r.seasonNumber, Number(r.lifeIndex)]),
  );

  const seasons: CompareSeason[] = snapshots.map((s: LifeSnapshotRow) => ({
    seasonNumber: s.seasonNumber,
    age: s.age,
    stats: s.stats,
    diary: s.diary,
    keyDecisions: s.keyDecisions,
    seasonOutcome: s.seasonOutcome,
    lifeIndex: indexBySeason.get(s.seasonNumber) ?? null,
  }));

  return toCompareLife(life, seasons);
}

function toCompareLife(life: LifeRow, seasons: CompareSeason[]): CompareLife {
  return {
    id: life.id,
    characterId: life.characterId,
    status: life.status,
    currentSeason: life.currentSeason,
    currentStats: life.stats,
    endingCode: null, // появится в фазе 4 (finish)
    seasons,
  };
}

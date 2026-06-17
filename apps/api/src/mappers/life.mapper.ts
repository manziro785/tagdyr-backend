import type { LifeRow, LifeSnapshotRow } from '../db/schema.js';
import type { LifeSummary, LifeDetail, LifeSnapshot } from '@tagdyr/schemas';

export function toLifeSummary(row: LifeRow): LifeSummary {
  return {
    id: row.id,
    slotIndex: row.slotIndex,
    characterId: row.characterId,
    status: row.status,
    currentSeason: row.currentSeason,
    age: row.age,
    stats: row.stats,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toLifeSnapshot(row: LifeSnapshotRow): LifeSnapshot {
  return {
    id: row.id,
    lifeId: row.lifeId,
    seasonNumber: row.seasonNumber,
    age: row.age,
    stats: row.stats,
    flags: row.flags,
    debts: row.debts,
    keyDecisions: row.keyDecisions,
    diary: row.diary,
    seasonOutcome: row.seasonOutcome,
    epilogue: row.epilogue,
    seed: row.seed,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLifeDetail(row: LifeRow, lastSnapshot: LifeSnapshotRow | undefined): LifeDetail {
  return {
    ...toLifeSummary(row),
    flags: row.flags,
    debts: row.debts,
    seed: row.seed,
    lastSnapshot: lastSnapshot ? toLifeSnapshot(lastSnapshot) : null,
  };
}

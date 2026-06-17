import { getCharacter } from '@tagdyr/content';
import type { CreateLifeRequest, LifeSummary, LifeDetail } from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { livesRepo } from '../repositories/lives.repo.js';
import { toLifeSummary, toLifeDetail } from '../mappers/life.mapper.js';
import { conflict, forbidden, notFound, validation } from '../http/errors.js';

const STARTING_AGE = 17;

export async function listLives(userId: string): Promise<LifeSummary[]> {
  const rows = await livesRepo.listByUser(db, userId);
  return rows.map(toLifeSummary);
}

export async function getLife(userId: string, lifeId: string): Promise<LifeDetail> {
  const life = await livesRepo.findById(db, lifeId);
  if (!life) throw notFound('Life not found');
  if (life.userId !== userId) throw forbidden('Not your life');
  const last = await livesRepo.lastSnapshot(db, lifeId);
  return toLifeDetail(life, last);
}

export async function createLife(
  userId: string,
  body: CreateLifeRequest,
): Promise<LifeDetail> {
  const character = getCharacter(body.characterId);
  if (!character) throw validation('Unknown characterId', { characterId: body.characterId });

  return db.transaction(async (tx) => {
    const occupied = await livesRepo.findByUserSlot(tx, userId, body.slotIndex);
    if (occupied) throw conflict(`Slot ${body.slotIndex} already in use`);

    const life = await livesRepo.insert(tx, {
      userId,
      slotIndex: body.slotIndex,
      characterId: character.id,
      status: 'active',
      currentSeason: 1,
      age: character.age || STARTING_AGE,
      stats: character.startStats,
      flags: {},
      debts: [],
      seed: body.seed,
    });

    return toLifeDetail(life, undefined);
  });
}

/** Архивирование (мягкое удаление) слота. */
export async function archiveLife(userId: string, lifeId: string): Promise<void> {
  const life = await livesRepo.findById(db, lifeId);
  if (!life) throw notFound('Life not found');
  if (life.userId !== userId) throw forbidden('Not your life');
  await livesRepo.update(db, lifeId, { status: 'archived' });
}

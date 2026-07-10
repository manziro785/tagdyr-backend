import { eq, sql } from 'drizzle-orm';
import { computeLifeIndex, resolveEnding } from '@tagdyr/engine';
import { characters, getEnding } from '@tagdyr/content';
import type { FinishLifeResponse } from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { seasonResults, userCharacters, userEndings, userKnowledgeCards } from '../db/schema.js';
import { livesRepo } from '../repositories/lives.repo.js';
import { conflict, forbidden, internal, notFound } from '../http/errors.js';
import { getEngineConfig } from '../config/engine-config.js';

export interface FinishLifeParams {
  userId: string;
  lifeId: string;
}

/**
 * Финал жизни (§5.2, фаза 4): после завершения последнего сезона разрешаем
 * глобальную концовку, пересчитываем индекс с бонусом архетипа и фиксируем
 * разблокировки (концовка + персонажи). Идемпотентен: повторный вызов
 * возвращает ту же концовку, ничего не дублируя.
 */
export async function finishLife(params: FinishLifeParams): Promise<FinishLifeResponse> {
  const { userId, lifeId } = params;
  const cfg = getEngineConfig();

  return db.transaction(async (tx) => {
    const life = await livesRepo.findById(tx, lifeId);
    if (!life) throw notFound('Life not found');
    if (life.userId !== userId) throw forbidden('Not your life');
    if (life.status !== 'finished') {
      throw conflict('Life is not finished yet: complete the final season first');
    }

    // концовка — детерминированная функция финального состояния
    const endingCode = resolveEnding({
      stats: life.stats,
      flags: life.flags,
      debts: life.debts,
    });
    const ending = getEnding(endingCode);
    if (!ending) throw internal(`Ending content missing for code "${endingCode}"`);

    // финальный индекс: те же веса + бонус архетипа
    const cardRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userKnowledgeCards)
      .where(eq(userKnowledgeCards.userId, userId));
    const cardsCount = cardRows[0]?.count ?? 0;

    const lifeIndex = computeLifeIndex(
      { stats: life.stats, cardsCount, endingBonus: ending.bonus },
      cfg,
    );

    // обновляем результат финального сезона — теперь с бонусом концовки
    await tx
      .insert(seasonResults)
      .values({
        lifeId,
        userId,
        seasonNumber: life.currentSeason,
        lifeIndex: lifeIndex.toString(),
      })
      .onConflictDoUpdate({
        target: [seasonResults.lifeId, seasonResults.seasonNumber],
        set: { lifeIndex: lifeIndex.toString(), createdAt: new Date() },
      });

    // коллекция концовок: returning() пуст при конфликте → концовка уже была
    const inserted = await tx
      .insert(userEndings)
      .values({ userId, endingId: ending.id, lifeId })
      .onConflictDoNothing()
      .returning();
    const newEnding = inserted.length > 0;

    // разблокировка персонажей с условием ending:<code>
    const toUnlock = characters.filter((ch) => ch.unlockCondition === `ending:${endingCode}`);
    const unlockedCharacterIds: string[] = [];
    for (const ch of toUnlock) {
      const rows = await tx
        .insert(userCharacters)
        .values({ userId, characterId: ch.id })
        .onConflictDoNothing()
        .returning();
      if (rows.length > 0) unlockedCharacterIds.push(ch.id);
    }

    return { ending, lifeIndex, newEnding, unlockedCharacterIds };
  });
}

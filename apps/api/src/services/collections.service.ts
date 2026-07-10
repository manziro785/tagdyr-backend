import { eq } from 'drizzle-orm';
import { characters, endings, knowledgeCards } from '@tagdyr/content';
import type { CardsCollection, CharactersRoster, EndingsCollection } from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { userCharacters, userEndings, userKnowledgeCards } from '../db/schema.js';

/**
 * Коллекции пользователя (§5.3): контент целиком + отметки разблокировки.
 * Закрытые позиции тоже отдаём — галерея показывает «3 из 12» с силуэтами.
 */

export async function getEndingsCollection(userId: string): Promise<EndingsCollection> {
  const rows = await db
    .select({ endingId: userEndings.endingId, unlockedAt: userEndings.unlockedAt })
    .from(userEndings)
    .where(eq(userEndings.userId, userId));
  const unlockedAt = new Map(rows.map((r) => [r.endingId, r.unlockedAt]));

  const items = endings.map((e) => ({
    ...e,
    unlockedAt: unlockedAt.get(e.id)?.toISOString() ?? null,
  }));
  return { total: items.length, unlocked: rows.length, items };
}

export async function getCardsCollection(userId: string): Promise<CardsCollection> {
  const rows = await db
    .select({ cardId: userKnowledgeCards.cardId, unlockedAt: userKnowledgeCards.unlockedAt })
    .from(userKnowledgeCards)
    .where(eq(userKnowledgeCards.userId, userId));
  // complete пишет коды карточек (клиент оперирует кодами), сверяем по code
  const unlockedAt = new Map(rows.map((r) => [r.cardId, r.unlockedAt]));

  const items = knowledgeCards.map((k) => ({
    ...k,
    unlockedAt: (unlockedAt.get(k.code) ?? unlockedAt.get(k.id))?.toISOString() ?? null,
  }));
  const unlocked = items.filter((i) => i.unlockedAt !== null).length;
  return { total: items.length, unlocked, items };
}

export async function getCharactersRoster(userId: string): Promise<CharactersRoster> {
  const rows = await db
    .select({ characterId: userCharacters.characterId })
    .from(userCharacters)
    .where(eq(userCharacters.userId, userId));
  const owned = new Set(rows.map((r) => r.characterId));

  const items = characters.map((ch) => ({
    ...ch,
    unlocked: !ch.isUnlockable || owned.has(ch.id),
  }));
  return { items };
}

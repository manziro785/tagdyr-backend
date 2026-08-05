import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { resolveEnding } from '@tagdyr/engine';
import { getEnding } from '@tagdyr/content';
import type { ShareLink, SharePayload } from '@tagdyr/schemas';
import { db } from '../db/client.js';
import { lives, shareTokens, users } from '../db/schema.js';
import { livesRepo } from '../repositories/lives.repo.js';
import { forbidden, notFound } from '../http/errors.js';
import type { LifeRow } from '../db/schema.js';
import type { DB } from '../db/client.js';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

/** Неперебираемый токен (§11): 24 случайных байта в base64url ≈ 32 символа. */
function newToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Публичный срез жизни. Ни email, ни флагов, ни дневника — только витрина.
 * Концовку показываем лишь для завершённых жизней (в игре она появляется на финале).
 */
async function buildPayload(
  exec: Executor,
  life: LifeRow,
  ownerName: string,
): Promise<SharePayload> {
  const results = await livesRepo.allResults(exec, life.id);
  const bestIndex = results.reduce((max, r) => Math.max(max, Number(r.lifeIndex)), 0);

  let endingId: string | null = null;
  let endingTitle: string | null = null;
  if (life.status === 'finished') {
    const ending = getEnding(resolveEnding({ stats: life.stats, flags: life.flags, debts: life.debts }));
    if (ending) {
      endingId = ending.id;
      endingTitle = ending.title;
    }
  }

  return {
    lifeId: life.id,
    displayName: ownerName,
    characterId: life.characterId,
    status: life.status,
    seasonsPlayed: results.length,
    age: life.age,
    stats: life.stats,
    lifeIndex: bestIndex,
    endingId,
    endingTitle,
    createdAt: life.createdAt.toISOString(),
  };
}

/** Имя владельца жизни одним джойном (для витрины). */
async function ownerNameOf(exec: Executor, lifeId: string): Promise<string | undefined> {
  const rows = await exec
    .select({ displayName: users.displayName })
    .from(lives)
    .innerJoin(users, eq(users.id, lives.userId))
    .where(eq(lives.id, lifeId))
    .limit(1);
  return rows[0]?.displayName;
}

/**
 * GET /lives/:id/share — владелец получает (создаёт при первом обращении)
 * стабильный публичный токен и тот же срез, что увидит получатель ссылки.
 */
export async function createShareLink(userId: string, lifeId: string): Promise<ShareLink> {
  return db.transaction(async (tx) => {
    const life = await livesRepo.findById(tx, lifeId);
    if (!life) throw notFound('Life not found');
    if (life.userId !== userId) throw forbidden('Not your life');

    // один токен на жизнь: если уже есть — переиспользуем (ссылка не «протухает»)
    const existing = await tx
      .select({ token: shareTokens.token })
      .from(shareTokens)
      .where(eq(shareTokens.lifeId, lifeId))
      .limit(1);

    let token = existing[0]?.token;
    if (!token) {
      token = newToken();
      await tx.insert(shareTokens).values({ token, lifeId });
    }

    const ownerName = (await ownerNameOf(tx, lifeId)) ?? 'Игрок';
    const payload = await buildPayload(tx, life, ownerName);
    return { token, payload };
  });
}

/**
 * GET /share/:token — публичные данные по токену, без авторизации.
 * Токен неперебираем; отдаём только безопасный срез.
 */
export async function getSharedLife(token: string): Promise<SharePayload> {
  const rows = await db
    .select({ lifeId: shareTokens.lifeId })
    .from(shareTokens)
    .where(eq(shareTokens.token, token))
    .limit(1);
  const lifeId = rows[0]?.lifeId;
  if (!lifeId) throw notFound('Share link not found');

  const life = await livesRepo.findById(db, lifeId);
  if (!life) throw notFound('Life not found');

  const ownerName = (await ownerNameOf(db, lifeId)) ?? 'Игрок';
  return buildPayload(db, life, ownerName);
}

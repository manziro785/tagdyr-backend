import { and, eq, desc } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import { lives, lifeSnapshots } from '../db/schema.js';
import type { LifeRow, LifeSnapshotRow } from '../db/schema.js';

/** Тип «исполнителя запроса» — db или транзакция. */
type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export const livesRepo = {
  listByUser(exec: Executor, userId: string): Promise<LifeRow[]> {
    return exec.select().from(lives).where(eq(lives.userId, userId)).orderBy(lives.slotIndex);
  },

  async findById(exec: Executor, lifeId: string): Promise<LifeRow | undefined> {
    const rows = await exec.select().from(lives).where(eq(lives.id, lifeId)).limit(1);
    return rows[0];
  },

  async findByUserSlot(
    exec: Executor,
    userId: string,
    slotIndex: number,
  ): Promise<LifeRow | undefined> {
    const rows = await exec
      .select()
      .from(lives)
      .where(and(eq(lives.userId, userId), eq(lives.slotIndex, slotIndex)))
      .limit(1);
    return rows[0];
  },

  async insert(exec: Executor, values: typeof lives.$inferInsert): Promise<LifeRow> {
    const rows = await exec.insert(lives).values(values).returning();
    return rows[0]!;
  },

  async update(
    exec: Executor,
    lifeId: string,
    patch: Partial<typeof lives.$inferInsert>,
  ): Promise<LifeRow> {
    const rows = await exec
      .update(lives)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(lives.id, lifeId))
      .returning();
    return rows[0]!;
  },

  async delete(exec: Executor, lifeId: string): Promise<void> {
    await exec.delete(lives).where(eq(lives.id, lifeId));
  },

  // ── snapshots ───────────────────────────────────────────────────────────────

  async lastSnapshot(exec: Executor, lifeId: string): Promise<LifeSnapshotRow | undefined> {
    const rows = await exec
      .select()
      .from(lifeSnapshots)
      .where(eq(lifeSnapshots.lifeId, lifeId))
      .orderBy(desc(lifeSnapshots.seasonNumber))
      .limit(1);
    return rows[0];
  },

  async snapshotByKey(
    exec: Executor,
    lifeId: string,
    idempotencyKey: string,
  ): Promise<LifeSnapshotRow | undefined> {
    const rows = await exec
      .select()
      .from(lifeSnapshots)
      .where(
        and(eq(lifeSnapshots.lifeId, lifeId), eq(lifeSnapshots.idempotencyKey, idempotencyKey)),
      )
      .limit(1);
    return rows[0];
  },

  async insertSnapshot(
    exec: Executor,
    values: typeof lifeSnapshots.$inferInsert,
  ): Promise<LifeSnapshotRow> {
    const rows = await exec.insert(lifeSnapshots).values(values).returning();
    return rows[0]!;
  },
};

import { eq } from 'drizzle-orm';
import type { DB } from '../db/client.js';
import { users } from '../db/schema.js';
import type { UserRow } from '../db/schema.js';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export const usersRepo = {
  async findById(exec: Executor, id: string): Promise<UserRow | undefined> {
    const rows = await exec.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  },

  async update(
    exec: Executor,
    id: string,
    patch: Partial<typeof users.$inferInsert>,
  ): Promise<UserRow> {
    const rows = await exec.update(users).set(patch).where(eq(users.id, id)).returning();
    return rows[0]!;
  },
};

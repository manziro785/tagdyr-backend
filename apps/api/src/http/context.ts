/** Типизированные переменные в Hono Context (c.get / c.set). */
export interface AppVariables {
  requestId: string;
  /** userId из проверенного JWT — ставится authMiddleware. */
  userId?: string;
}

export type AppEnv = { Variables: AppVariables };

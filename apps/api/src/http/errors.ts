import type { Context } from 'hono';
import { ERROR_STATUS, type ErrorCode, type ApiError } from '@tagdyr/schemas';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Доменная ошибка с кодом из единого набора (§10). */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toBody(): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

// удобные фабрики — читаются как намерение в коде роутов
export const unauthorized = (m = 'Unauthorized', d?: unknown) => new AppError('UNAUTHORIZED', m, d);
export const forbidden = (m = 'Forbidden', d?: unknown) => new AppError('FORBIDDEN', m, d);
export const notFound = (m = 'Not found', d?: unknown) => new AppError('NOT_FOUND', m, d);
export const validation = (m = 'Validation failed', d?: unknown) => new AppError('VALIDATION', m, d);
export const conflict = (m = 'Conflict', d?: unknown) => new AppError('CONFLICT', m, d);
export const rateLimited = (m = 'Rate limited', d?: unknown) => new AppError('RATE_LIMITED', m, d);
export const internal = (m = 'Internal error', d?: unknown) => new AppError('INTERNAL', m, d);

/** Отправить тело ошибки в едином формате. */
export function sendError(c: Context, err: AppError) {
  return c.json(err.toBody(), err.status as ContentfulStatusCode);
}

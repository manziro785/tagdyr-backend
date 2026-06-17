import type { Options } from 'postgres';

/**
 * SSL-опция для postgres-js по строке подключения.
 * - localhost → без TLS;
 * - Render external (самоподписанный CA) → rejectUnauthorized: false.
 *   ssl:'require' с Render даёт ECONNRESET, поэтому передаём объект.
 */
export function sslFor(url: string): Options<Record<string, never>>['ssl'] {
  if (/localhost|127\.0\.0\.1/.test(url)) return false;
  return { rejectUnauthorized: false };
}

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// promisify теряет перегрузку с options — оборачиваем вручную
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/**
 * Хэширование паролей на встроенном crypto.scrypt — без внешних зависимостей.
 * Формат хранения: scrypt:N:r:p:salt:hash (base64url), параметры зашиты в строку,
 * чтобы их можно было усилить в будущем без ломки старых хэшей.
 */
const N = 16384;
const r = 8;
const p = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scrypt(password, salt, KEY_LEN, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const params = { N: Number(nStr), r: Number(rStr), p: Number(pStr) };
  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) {
    return false;
  }
  const salt = Buffer.from(saltB64!, 'base64url');
  const expected = Buffer.from(hashB64!, 'base64url');
  if (expected.length === 0) return false;
  try {
    const actual = await scrypt(password, salt, expected.length, params);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    // невалидные параметры scrypt в строке хэша
    return false;
  }
}

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { loadEnv } from '../config/env.js';
import { unauthorized } from '../http/errors.js';

const env = loadEnv();
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ISSUER = 'tagdyr-api';
const AUDIENCE = 'tagdyr-app';

export interface AccessClaims {
  sub: string; // userId
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function sign(
  userId: string,
  secret: Uint8Array,
  ttlSeconds: number,
  type: 'access' | 'refresh',
): Promise<string> {
  return new SignJWT({ type })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

/** Выпуск пары access+refresh для пользователя. */
export async function issueTokenPair(userId: string): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    sign(userId, accessSecret, env.JWT_ACCESS_TTL, 'access'),
    sign(userId, refreshSecret, env.JWT_REFRESH_TTL, 'refresh'),
  ]);
  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL };
}

async function verify(
  token: string,
  secret: Uint8Array,
  expectedType: 'access' | 'refresh',
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
    if (payload.type !== expectedType || typeof payload.sub !== 'string') {
      throw unauthorized('Invalid token');
    }
    return payload.sub;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) throw unauthorized('Token expired');
    if (err instanceof joseErrors.JOSEError) throw unauthorized('Invalid token');
    throw err;
  }
}

export const verifyAccessToken = (token: string) => verify(token, accessSecret, 'access');
export const verifyRefreshToken = (token: string) => verify(token, refreshSecret, 'refresh');

import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Проверка ID-токена Google (GIS). Подпись сверяем с публичными ключами
 * Google (JWKS кэшируется внутри jose), audience — с нашим client id.
 */

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// ленивый singleton: не ходим за ключами, пока Google-вход не используется
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export interface GoogleProfile {
  /** Стабильный id аккаунта Google — наш provider_id. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** Бросает, если токен не прошёл проверку подписи/issuer/audience/срока. */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleProfile> {
  jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
  });

  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  };
}

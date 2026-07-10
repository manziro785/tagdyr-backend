import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password (scrypt)', () => {
  it('хэширует и верифицирует пароль', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt:')).toBe(true);
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('отклоняет неверный пароль', async () => {
    const hash = await hashPassword('secret-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('соль уникальна: одинаковые пароли дают разные хэши', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  });

  it('не падает на мусорной строке хэша', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt:bad:values:here:AA:BB')).resolves.toBe(false);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config.ts';
import { getDb } from '../src/db/index.ts';
import { sha256Hex } from '../src/lib/crypto.ts';
import { setTransportForTests } from '../src/lib/mailer.ts';
import { createTestApp, registerUser, resetAll } from './helpers.ts';

const FORGOT_URL = '/api/auth/forgot-password';
const RESET_URL = '/api/auth/reset-password';
const INVALID_TOKEN_MESSAGE = 'Ссылка для восстановления пароля недействительна или устарела.';

let app: Express;

beforeEach(() => {
  resetAll();
  setTransportForTests(null);
  app = createTestApp();
});

function forgotRequest(email: string, ip: string) {
  return request(app).post(FORGOT_URL).set('X-Forwarded-For', ip).send({ email });
}

function resetRequest(token: string, password: string, ip: string, cookie?: string) {
  const headers: Record<string, string> = { 'X-Forwarded-For': ip };
  if (cookie !== undefined) headers.Cookie = cookie;
  return request(app).post(RESET_URL).set(headers).send({ token, password });
}

function tokenFromDebugUrl(debugUrl: unknown): string {
  expect(typeof debugUrl).toBe('string');
  const url = new URL(String(debugUrl));
  expect(url.pathname).toBe('/reset-password');
  const token = url.searchParams.get('token');
  expect(token).toBeTruthy();
  return token ?? '';
}

interface PasswordResetDbRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

function findResetRow(userId: string): PasswordResetDbRow | undefined {
  return getDb()
    .prepare('SELECT * FROM password_resets WHERE user_id = ? ORDER BY created_at DESC')
    .get(userId) as PasswordResetDbRow | undefined;
}

function countResetRows(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM password_resets').get() as {
    count: number;
  };
  return row.count;
}

function countSessions(userId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?')
    .get(userId) as { count: number };
  return row.count;
}

describe('POST /api/auth/forgot-password', () => {
  it('для существующего email создаёт одноразовый токен и отдаёт debugUrl (test)', async () => {
    const auth = await registerUser(app, {}, '10.30.0.1');
    const response = await forgotRequest(auth.email, '10.30.1.1');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.debugUrl).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/);

    const token = tokenFromDebugUrl(response.body.debugUrl);
    // 32 случайных байта в base64url — 43 символа.
    expect(token.length).toBeGreaterThanOrEqual(43);

    const row = findResetRow(auth.user.id);
    expect(row).toBeDefined();
    expect(row?.token_hash).toBe(sha256Hex(token));
    expect(row?.token_hash).not.toBe(token);
    expect(row?.token_hash).toHaveLength(64);
    expect(row?.used_at).toBeNull();

    const ttl = Date.parse(row?.expires_at ?? '') - Date.now();
    expect(ttl).toBeGreaterThan(59 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000 + 5000);
  });

  it('для несуществующего email не создаёт токен, но отвечает 200 ok', async () => {
    const response = await forgotRequest('nobody@example.com', '10.30.1.2');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(countResetRows()).toBe(0);
  });

  it('в production скрывает debugUrl, ответы для существующего и неизвестного email одинаковы', async () => {
    const auth = await registerUser(app, {}, '10.30.0.2');
    const mutableConfig = config as unknown as { env: string };
    const originalEnv = mutableConfig.env;
    mutableConfig.env = 'production';
    try {
      const existing = await forgotRequest(auth.email, '10.30.1.3');
      const unknown = await forgotRequest('nobody@example.com', '10.30.1.4');

      expect(existing.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(existing.body).toEqual({ ok: true });
      expect(unknown.body).toEqual({ ok: true });
      expect(existing.body).toEqual(unknown.body);
    } finally {
      mutableConfig.env = originalEnv;
    }
    // Токен для существующего email при этом создаётся.
    expect(countResetRows()).toBe(1);
  });

  it('не отдаёт debugUrl, если SMTP настроен', async () => {
    const auth = await registerUser(app, {}, '10.30.0.3');
    const mutableConfig = config as unknown as { smtpConfigured: boolean };
    const originalConfigured = mutableConfig.smtpConfigured;
    // Транспорт подменён, чтобы «настроенный» SMTP не пытался идти в сеть.
    setTransportForTests({ sendMail: async () => ({}) });
    mutableConfig.smtpConfigured = true;
    try {
      const response = await forgotRequest(auth.email, '10.30.1.5');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    } finally {
      mutableConfig.smtpConfigured = originalConfigured;
      setTransportForTests(null);
    }
  });

  it('доступен авторизованному клиенту без CSRF-заголовка', async () => {
    const auth = await registerUser(app, {}, '10.30.0.4');
    const response = await request(app)
      .post(FORGOT_URL)
      .set('Cookie', auth.cookie)
      .set('X-Forwarded-For', '10.30.1.6')
      .send({ email: auth.email });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('ограничивает запросы: 5 в час на IP, шестой — 429', async () => {
    const ip = '10.33.1.1';
    for (let index = 0; index < 5; index += 1) {
      const response = await forgotRequest(`nobody_${index}@example.com`, ip);
      expect(response.status).toBe(200);
    }
    const blocked = await forgotRequest('nobody_6@example.com', ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('ограничивает запросы: 5 в час на email, шестой — 429', async () => {
    const auth = await registerUser(app, {}, '10.33.2.0');
    for (let index = 0; index < 5; index += 1) {
      const response = await forgotRequest(auth.email, `10.33.2.${index + 1}`);
      expect(response.status).toBe(200);
    }
    const blocked = await forgotRequest(auth.email, '10.33.2.99');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('POST /api/auth/reset-password', () => {
  it('меняет пароль, гасит все сессии и одноразово использует токен', async () => {
    const auth = await registerUser(app, {}, '10.31.0.1');
    // Вторая сессия — как будто вход с другого устройства.
    const secondLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.31.0.2')
      .send({ email: auth.email, password: auth.password });
    expect(secondLogin.status).toBe(200);
    expect(countSessions(auth.user.id)).toBe(2);

    const forgot = await forgotRequest(auth.email, '10.31.0.3');
    const token = tokenFromDebugUrl(forgot.body.debugUrl);
    const newPassword = 'new-password-456';

    // Сессионная cookie есть, но CSRF-заголовка нет: публичный POST вне проверки CSRF.
    const reset = await resetRequest(token, newPassword, '10.31.0.4', auth.cookie);
    expect(reset.status).toBe(204);
    expect(reset.text).toBe('');

    expect(countSessions(auth.user.id)).toBe(0);
    expect(findResetRow(auth.user.id)?.used_at).not.toBeNull();

    const oldSession = await request(app).get('/api/auth/me').set('Cookie', auth.cookie);
    expect(oldSession.status).toBe(200);
    expect(oldSession.body.user).toBeNull();

    const oldPasswordLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.31.0.5')
      .send({ email: auth.email, password: auth.password });
    expect(oldPasswordLogin.status).toBe(401);
    expect(oldPasswordLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    const newPasswordLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.31.0.6')
      .send({ email: auth.email, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);

    const hashRow = getDb()
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(auth.user.id) as { password_hash: string };
    expect(hashRow.password_hash.startsWith('$argon2id$')).toBe(true);

    const reuse = await resetRequest(token, 'another-password-789', '10.31.0.7');
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');
    expect(reuse.body.error.message).toBe(INVALID_TOKEN_MESSAGE);
  });

  it('неверный, просроченный и использованный токен дают одинаковую ошибку', async () => {
    const messages: string[] = [];
    const codes: string[] = [];

    // 1. Несуществующий токен.
    const junk = await resetRequest('not-a-real-token'.padEnd(43, 'x'), 'new-password-123', '10.32.0.1');
    expect(junk.status).toBe(400);
    codes.push(junk.body.error.code);
    messages.push(junk.body.error.message);

    // 2. Просроченный токен.
    const expiredUser = await registerUser(app, {}, '10.32.0.2');
    const expiredForgot = await forgotRequest(expiredUser.email, '10.32.0.3');
    const expiredToken = tokenFromDebugUrl(expiredForgot.body.debugUrl);
    getDb()
      .prepare('UPDATE password_resets SET expires_at = ? WHERE user_id = ?')
      .run(new Date(Date.now() - 1000).toISOString(), expiredUser.user.id);
    const expired = await resetRequest(expiredToken, 'new-password-123', '10.32.0.4');
    expect(expired.status).toBe(400);
    codes.push(expired.body.error.code);
    messages.push(expired.body.error.message);

    // 3. Уже использованный токен.
    const usedUser = await registerUser(app, {}, '10.32.0.5');
    const usedForgot = await forgotRequest(usedUser.email, '10.32.0.6');
    const usedToken = tokenFromDebugUrl(usedForgot.body.debugUrl);
    const firstReset = await resetRequest(usedToken, 'new-password-123', '10.32.0.7');
    expect(firstReset.status).toBe(204);
    const reused = await resetRequest(usedToken, 'new-password-456', '10.32.0.8');
    expect(reused.status).toBe(400);
    codes.push(reused.body.error.code);
    messages.push(reused.body.error.message);

    expect(codes).toEqual(['INVALID_RESET_TOKEN', 'INVALID_RESET_TOKEN', 'INVALID_RESET_TOKEN']);
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe(INVALID_TOKEN_MESSAGE);
  });

  it('слабый пароль отклоняется валидацией, токен не сгорает', async () => {
    const auth = await registerUser(app, {}, '10.34.0.1');
    const forgot = await forgotRequest(auth.email, '10.34.0.2');
    const token = tokenFromDebugUrl(forgot.body.debugUrl);

    const response = await resetRequest(token, '123', '10.34.0.3');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body.error.details)).toMatch(/[а-яА-ЯёЁ]/);
    expect(findResetRow(auth.user.id)?.used_at).toBeNull();
  });

  it('новый запрос инвалидирует старые неиспользованные ссылки', async () => {
    const auth = await registerUser(app, {}, '10.35.0.1');
    const firstForgot = await forgotRequest(auth.email, '10.35.0.2');
    const secondForgot = await forgotRequest(auth.email, '10.35.0.3');
    const firstToken = tokenFromDebugUrl(firstForgot.body.debugUrl);
    const secondToken = tokenFromDebugUrl(secondForgot.body.debugUrl);
    expect(firstToken).not.toBe(secondToken);

    const first = await resetRequest(firstToken, 'new-password-123', '10.35.0.4');
    expect(first.status).toBe(400);
    expect(first.body.error.code).toBe('INVALID_RESET_TOKEN');

    const second = await resetRequest(secondToken, 'new-password-123', '10.35.0.5');
    expect(second.status).toBe(204);
  });
});

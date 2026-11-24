import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import {
  authHeaders,
  createTestApp,
  extractCookie,
  registerUser,
  resetAll,
  uniqueSuffix,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

function registerPayload(email = 'anna@example.com', username = 'anna') {
  return {
    email,
    password: 'password123',
    displayName: 'Анна',
    username,
  };
}

describe('POST /api/auth/register', () => {
  it('создаёт пользователя, сразу входит и отдаёт UserSelfDTO', async () => {
    const response = await request(app).post('/api/auth/register').send(registerPayload());

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: 'anna@example.com',
      username: 'anna',
      displayName: 'Анна',
      bio: null,
      avatarPath: null,
      showBirthYear: false,
      isProfilePublic: true,
    });
    expect(typeof response.body.user.id).toBe('string');
    expect(response.body.user).not.toHaveProperty('password_hash');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const sid = extractCookie(response, 'sid');
    const csrf = extractCookie(response, 'csrf');
    expect(sid).toBeTruthy();
    expect(csrf).toBeTruthy();

    const rawCookies = response.headers['set-cookie'] as unknown as string[];
    const sidCookie = rawCookies.find((cookie) => cookie.startsWith('sid=')) ?? '';
    const csrfCookie = rawCookies.find((cookie) => cookie.startsWith('csrf=')) ?? '';
    expect(sidCookie).toContain('HttpOnly');
    expect(sidCookie).toContain('SameSite=Lax');
    expect(csrfCookie).not.toContain('HttpOnly');

    // Сессия рабочая: /me возвращает того же пользователя.
    const me = await request(app).get('/api/auth/me').set('Cookie', `sid=${sid}; csrf=${csrf}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('anna@example.com');
    expect(extractCookie(me, 'csrf')).toBe(csrf);

    // Пароль — Argon2id, токен сессии в БД — только SHA-256 хеш.
    const passwordRow = getDb()
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .get('anna@example.com') as { password_hash: string };
    expect(passwordRow.password_hash.startsWith('$argon2id$')).toBe(true);
    const sessionRow = getDb()
      .prepare('SELECT token_hash FROM sessions WHERE user_id = ?')
      .get(response.body.user.id) as { token_hash: string };
    expect(sessionRow.token_hash).not.toBe(sid);
    expect(sessionRow.token_hash).toHaveLength(64);
  });

  it('нормализует email и логин (trim + нижний регистр)', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: '  Anna@Example.COM ', password: 'password123', displayName: 'Анна', username: 'Anna_2026' });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('anna@example.com');
    expect(response.body.user.username).toBe('anna_2026');
  });

  it('отклоняет занятый email и занятый логин', async () => {
    await request(app).post('/api/auth/register').send(registerPayload());

    const sameEmail = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ ...registerPayload('anna@example.com', 'another_login'), displayName: 'Другая' });
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.code).toBe('EMAIL_TAKEN');

    const sameUsername = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', '10.0.0.3')
      .send({ ...registerPayload('other@example.com', 'anna'), displayName: 'Другая' });
    expect(sameUsername.status).toBe(409);
    expect(sameUsername.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('валидирует данные и отвечает русским текстом', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'не-email', password: '123', displayName: '', username: 'Плохой логин!' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
    const detailsText = JSON.stringify(response.body.error.details);
    expect(detailsText).toMatch(/[а-яА-Я]/);
  });

  it('ограничивает регистрацию: 5 в час на IP, шестая — 429', async () => {
    const ip = '10.5.5.5';
    for (let index = 0; index < 5; index += 1) {
      const response = await request(app)
        .post('/api/auth/register')
        .set('X-Forwarded-For', ip)
        .send(registerPayload(`limit_${index}@example.com`, `limit_user_${index}`));
      expect(response.status).toBe(201);
    }
    const blocked = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', ip)
      .send(registerPayload('limit_6@example.com', 'limit_user_6'));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(typeof blocked.body.error.details.retryAfterSec).toBe('number');
  });
});

describe('POST /api/auth/login', () => {
  it('входит с верным паролем и не создаёт дубль сессии', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.1.1')
      .send({ email: auth.email, password: auth.password });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(auth.email);
    expect(extractCookie(response, 'sid')).toBeTruthy();
  });

  it('одинаково отвечает на неверный пароль и несуществующий email', async () => {
    const auth = await registerUser(app);
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.2.1')
      .send({ email: auth.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.2.2')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('ограничивает вход: 10 попыток за 15 минут на IP+email, 11-я — 429', async () => {
    const auth = await registerUser(app);
    for (let index = 0; index < 10; index += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.3.1')
        .send({ email: auth.email, password: 'wrong-password' });
      expect(response.status).toBe(401);
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '10.0.3.1')
      .send({ email: auth.email, password: auth.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('сессии и CSRF', () => {
  it('выход требует CSRF-заголовок и удаляет сессию', async () => {
    const auth = await registerUser(app);

    const withoutCsrf = await request(app).post('/api/auth/logout').set('Cookie', auth.cookie);
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.error.code).toBe('CSRF_FAILED');

    const logout = await request(app).post('/api/auth/logout').set(authHeaders(auth, true));
    expect(logout.status).toBe(204);

    const me = await request(app).get('/api/auth/me').set('Cookie', auth.cookie);
    expect(me.status).toBe(200);
    expect(me.body.user).toBeNull();
  });

  it('GET /api/auth/me у гостя возвращает user: null', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(200);
    expect(response.body.user).toBeNull();
  });
});

describe('PATCH /api/me/profile', () => {
  it('обновляет поля профиля и требует CSRF', async () => {
    const auth = await registerUser(app);

    const withoutCsrf = await request(app)
      .patch('/api/me/profile')
      .set('Cookie', auth.cookie)
      .send({ displayName: 'Анна Новая' });
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.error.code).toBe('CSRF_FAILED');

    const updated = await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(auth, true))
      .send({
        displayName: 'Анна Новая',
        bio: 'Люблю книги',
        birthMonth: 4,
        birthDay: 15,
        birthYear: 1992,
        showBirthYear: true,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({
      displayName: 'Анна Новая',
      bio: 'Люблю книги',
      birthMonth: 4,
      birthDay: 15,
      birthYear: 1992,
      showBirthYear: true,
    });
  });

  it('не принимает год рождения без месяца и дня', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(auth, true))
      .send({ birthYear: 1992 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('не принимает несуществующую дату рождения (31 февраля)', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(auth, true))
      .send({ birthMonth: 2, birthDay: 31, birthYear: 1992 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('требует авторизацию', async () => {
    const response = await request(app).patch('/api/me/profile').send({ displayName: 'Кто-то' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/users/:username', () => {
  it('отдаёт публичный профиль без email; год рождения скрыт по умолчанию', async () => {
    const auth = await registerUser(app, { displayName: 'Анна' });
    await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(auth, true))
      .send({ birthMonth: 4, birthDay: 15, birthYear: 1992, showBirthYear: false });

    const response = await request(app).get(`/api/users/${auth.user.username}`);
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      username: auth.user.username,
      displayName: 'Анна',
      birthMonth: 4,
      birthDay: 15,
      birthYear: null,
      showBirthYear: false,
    });
    expect(response.body.user).not.toHaveProperty('email');
    expect(JSON.stringify(response.body)).not.toContain(auth.email);
    expect(Array.isArray(response.body.wishlists)).toBe(true);
  });

  it('скрывает закрытый профиль от чужих (404), но показывает владельцу', async () => {
    const owner = await registerUser(app);
    await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(owner, true))
      .send({ isProfilePublic: false });

    const anonymous = await request(app).get(`/api/users/${owner.user.username}`);
    expect(anonymous.status).toBe(404);
    expect(anonymous.body.error.code).toBe('NOT_FOUND');

    const asOwner = await request(app).get(`/api/users/${owner.user.username}`).set('Cookie', owner.cookie);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.user.username).toBe(owner.user.username);
  });

  it('для неизвестного логина отвечает 404', async () => {
    const response = await request(app).get(`/api/users/no_such_${uniqueSuffix()}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

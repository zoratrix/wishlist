import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createTestApp,
  createWishlist,
  registerUser,
  resetAll,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

const GIFT = '🎁';
const BOOKS = '📚';

describe('эмодзи-оформление вишлиста', () => {
  it('создаёт вишлист с эмодзи; по умолчанию null', async () => {
    const auth = await registerUser(app);

    const themed = await createWishlist(app, auth, { title: 'С подарком', themeEmoji: GIFT });
    expect(themed.themeEmoji).toBe(GIFT);

    const plain = await createWishlist(app, auth, { title: 'Без эмодзи' });
    expect(plain.themeEmoji).toBeNull();

    const explicitNull = await createWishlist(app, auth, { title: 'Null', themeEmoji: null });
    expect(explicitNull.themeEmoji).toBeNull();

    // trim: пробелы вокруг эмодзи не сохраняются.
    const padded = await createWishlist(app, auth, { title: 'С пробелами', themeEmoji: '  📚  ' });
    expect(padded.themeEmoji).toBe(BOOKS);
  });

  it('принимает составные эмодзи в пределах 8 UTF-16 символов', async () => {
    const auth = await registerUser(app);

    const heart = await createWishlist(app, auth, { title: 'Сердце', themeEmoji: '❤️' });
    expect(heart.themeEmoji).toBe('❤️');

    const rainbow = await createWishlist(app, auth, { title: 'Радуга', themeEmoji: '🏳️‍🌈' });
    expect(rainbow.themeEmoji).toBe('🏳️‍🌈');

    // Ровно 8 UTF-16 символов (4 эмодзи по 2) — допустимый максимум.
    const maxLength = await createWishlist(app, auth, { title: 'Максимум', themeEmoji: '🎁🎁🎁🎁' });
    expect(maxLength.themeEmoji).toBe('🎁🎁🎁🎁');
  });

  it('меняет и сбрасывает эмодзи через PATCH', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { themeEmoji: GIFT });

    const changed = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeEmoji: BOOKS });
    expect(changed.status).toBe(200);
    expect(changed.body.wishlist.themeEmoji).toBe(BOOKS);

    const reset = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeEmoji: null });
    expect(reset.status).toBe(200);
    expect(reset.body.wishlist.themeEmoji).toBeNull();
  });

  it('PATCH без themeEmoji не меняет эмодзи', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { themeEmoji: GIFT });

    const renamed = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Новое название' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.wishlist.themeEmoji).toBe(GIFT);

    // Сброс цвета-темы не должен затрагивать эмодзи.
    const colorReset = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeColor: null });
    expect(colorReset.status).toBe(200);
    expect(colorReset.body.wishlist.themeEmoji).toBe(GIFT);
  });

  it('невалидные значения → 400 INVALID_EMOJI (create и patch)', async () => {
    const auth = await registerUser(app);
    const invalidValues: unknown[] = [
      'abc', // ASCII-буквы без эмодзи
      '', // пустая строка
      '   ', // только пробелы
      '🎁🎁🎁🎁🎁', // 10 UTF-16 символов — больше 8
      '🎁 x', // ASCII-буква и пробел
      '🎁a', // ASCII-буква
      '🎁1', // ASCII-цифра
      'подарок 🎁', // текст вокруг эмодзи
      42, // не строка
      { emoji: GIFT }, // не строка
      ['🎁'], // массив
    ];

    for (const themeEmoji of invalidValues) {
      const created = await request(app)
        .post('/api/me/wishlists')
        .set(authHeaders(auth, true))
        .send({ title: 'Плохой эмодзи', themeEmoji });
      expect(created.status, `create: ${JSON.stringify(themeEmoji)}`).toBe(400);
      expect(created.body.error.code).toBe('INVALID_EMOJI');
      expect(typeof created.body.error.message).toBe('string');
      expect(created.body.error.message.length).toBeGreaterThan(0);
    }

    const wishlist = await createWishlist(app, auth, { themeEmoji: GIFT });
    for (const themeEmoji of invalidValues) {
      const patched = await request(app)
        .patch(`/api/me/wishlists/${wishlist.id}`)
        .set(authHeaders(auth, true))
        .send({ themeEmoji });
      expect(patched.status, `patch: ${JSON.stringify(themeEmoji)}`).toBe(400);
      expect(patched.body.error.code).toBe('INVALID_EMOJI');
    }

    // Невалидный PATCH не должен портить уже сохранённый эмодзи.
    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth));
    expect(detail.body.wishlist.themeEmoji).toBe(GIFT);
  });

  it('эмодзи виден владельцу и в публичном виде', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, {
      title: 'Тематический',
      visibility: 'public',
      themeEmoji: BOOKS,
    });

    const list = await request(app).get('/api/me/wishlists').set(authHeaders(auth));
    expect(list.body.wishlists[0].themeEmoji).toBe(BOOKS);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth));
    expect(detail.body.wishlist.themeEmoji).toBe(BOOKS);

    const publicView = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.wishlist.themeEmoji).toBe(BOOKS);
  });
});

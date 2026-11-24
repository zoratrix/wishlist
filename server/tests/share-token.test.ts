import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import {
  bookRequest,
  createGift,
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

const SHORT_TOKEN_PATTERN = /^[A-Za-z0-9]{7}$/;

describe('короткие share-ссылки', () => {
  it('новый вишлист получает shareToken из 7 символов [A-Za-z0-9]', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);

    expect(wishlist.shareToken).toMatch(SHORT_TOKEN_PATTERN);
  });

  it('20 подряд созданных вишлистов имеют уникальные короткие токены', async () => {
    const auth = await registerUser(app);
    const tokens: string[] = [];
    for (let index = 0; index < 20; index += 1) {
      const wishlist = await createWishlist(app, auth, { title: `Список ${index}` });
      expect(wishlist.shareToken).toMatch(SHORT_TOKEN_PATTERN);
      tokens.push(wishlist.shareToken);
    }

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('короткий токен открывает публичную страницу', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { title: 'Короткая ссылка' });

    const response = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(response.status).toBe(200);
    expect(response.body.wishlist.id).toBe(wishlist.id);
  });

  it('ранее выданный длинный токен продолжает открывать страницу', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { title: 'Старая ссылка', visibility: 'link' });
    const gift = await createGift(app, auth, wishlist.id, { title: 'Подарок' });

    const legacyToken = 'anna-birthday-2026-long-legacy-token';
    getDb()
      .prepare('UPDATE wishlists SET share_token = ? WHERE id = ?')
      .run(legacyToken, wishlist.id);

    const response = await request(app).get(`/api/w/${legacyToken}`);
    expect(response.status).toBe(200);
    expect(response.body.wishlist.id).toBe(wishlist.id);
    expect(response.body.gifts[0].id).toBe(gift.id);

    // Бронирование по старой ссылке тоже работает.
    const booked = await bookRequest(app, legacyToken, gift.id, {
      name: 'Мария',
      email: 'maria@example.com',
    });
    expect(booked.status).toBe(201);

    // Старый короткий токен после замены больше не действует.
    const oldShort = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(oldShort.status).toBe(404);
  });

  it('токены не содержат символов вне [A-Za-z0-9] и не меняются при PATCH вишлиста', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);

    const patched = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set('Cookie', `sid=${auth.sid}; csrf=${auth.csrf}`)
      .set('X-CSRF-Token', auth.csrf)
      .send({ title: 'Новое название' });
    expect(patched.status).toBe(200);
    expect(patched.body.wishlist.shareToken).toBe(wishlist.shareToken);

    expect(wishlist.shareToken).not.toMatch(/[-_]/);
  });

  it('перевыпускает длинную ссылку на короткую, старая перестаёт работать', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { title: 'Длинная ссылка' });
    const legacy = 'vnWCsgpkCL_NmTHZLw0TmusA';
    getDb()
      .prepare('UPDATE wishlists SET share_token = ? WHERE id = ?')
      .run(legacy, wishlist.id);

    const regenerated = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/share-token`)
      .set('Cookie', `sid=${auth.sid}; csrf=${auth.csrf}`)
      .set('X-CSRF-Token', auth.csrf);
    expect(regenerated.status).toBe(200);
    const token: string = regenerated.body.wishlist.shareToken;
    expect(token).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(token).not.toBe(legacy);

    expect((await request(app).get(`/api/w/${legacy}`)).status).toBe(404);
    expect((await request(app).get(`/api/w/${token}`)).status).toBe(200);
  });

  it('не перевыпускает ссылку чужого вишлиста', async () => {
    const owner = await registerUser(app);
    const wishlist = await createWishlist(app, owner);
    const other = await registerUser(app);

    const response = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/share-token`)
      .set('Cookie', `sid=${other.sid}; csrf=${other.csrf}`)
      .set('X-CSRF-Token', other.csrf);
    expect(response.status).toBe(404);
  });
});

import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
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

describe('вишлисты владельца', () => {
  it('создаёт, читает и перечисляет вишлисты', async () => {
    const auth = await registerUser(app);
    const created = await request(app)
      .post('/api/me/wishlists')
      .set(authHeaders(auth, true))
      .send({ title: 'День рождения', description: 'Подарки', eventDate: '2026-12-20', visibility: 'link' });

    expect(created.status).toBe(201);
    expect(created.body.wishlist).toMatchObject({
      title: 'День рождения',
      description: 'Подарки',
      eventDate: '2026-12-20',
      visibility: 'link',
      sortOrder: 0,
      showBooked: false,
      showBookerNames: false,
      giftCount: 0,
    });
    expect(created.body.wishlist.shareToken).toMatch(/^[A-Za-z0-9]{7}$/);

    const list = await request(app).get('/api/me/wishlists').set(authHeaders(auth));
    expect(list.status).toBe(200);
    expect(list.body.wishlists).toHaveLength(1);
    expect(list.body.wishlists[0].id).toBe(created.body.wishlist.id);
  });

  it('обновляет поля, включая переключатели приватности броней', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);

    const updated = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Новое название', showBooked: true, visibility: 'public' });
    expect(updated.status).toBe(200);
    expect(updated.body.wishlist).toMatchObject({ title: 'Новое название', showBooked: true, showBookerNames: false });

    const withNames = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ showBookerNames: true });
    expect(withNames.status).toBe(200);
    expect(withNames.body.wishlist).toMatchObject({ showBooked: true, showBookerNames: true });

    const hideBooked = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ showBooked: false });
    expect(hideBooked.status).toBe(200);
    expect(hideBooked.body.wishlist.showBooked).toBe(false);
    // Имена автоматически гасятся, флаги остаются согласованными.
    expect(hideBooked.body.wishlist.showBookerNames).toBe(false);
  });

  it('не включает показ имён, пока выключен показ броней (422)', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);
    const response = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ showBookerNames: true });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SHOW_NAMES_REQUIRES_BOOKED');
  });

  it('меняет порядок вишлистов', async () => {
    const auth = await registerUser(app);
    const first = await createWishlist(app, auth, { title: 'Первый' });
    const second = await createWishlist(app, auth, { title: 'Второй' });
    const third = await createWishlist(app, auth, { title: 'Третий' });
    expect([first.sortOrder, second.sortOrder, third.sortOrder]).toEqual([0, 1, 2]);

    const reordered = await request(app)
      .post('/api/me/wishlists/reorder')
      .set(authHeaders(auth, true))
      .send({ order: [third.id, first.id, second.id] });
    expect(reordered.status).toBe(204);

    const list = await request(app).get('/api/me/wishlists').set(authHeaders(auth));
    expect(list.body.wishlists.map((item: { id: string }) => item.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });

  it('удаляет вишлист вместе с подарками', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);
    const gift = await createGift(app, auth, wishlist.id);

    const deleted = await request(app)
      .delete(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(204);

    const detail = await request(app).get(`/api/me/wishlists/${wishlist.id}`).set(authHeaders(auth));
    expect(detail.status).toBe(404);

    const giftPatch = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Не важно' });
    expect(giftPatch.status).toBe(404);
  });

  it('валидирует дату и видимость', async () => {
    const auth = await registerUser(app);
    const badDate = await request(app)
      .post('/api/me/wishlists')
      .set(authHeaders(auth, true))
      .send({ title: 'Список', eventDate: '2026-02-30' });
    expect(badDate.status).toBe(400);
    expect(badDate.body.error.code).toBe('VALIDATION_ERROR');

    // 'followers' теперь допустим (этап 3), а неизвестная видимость — нет.
    const badVisibility = await request(app)
      .post('/api/me/wishlists')
      .set(authHeaders(auth, true))
      .send({ title: 'Список', visibility: 'secret' });
    expect(badVisibility.status).toBe(400);
    expect(badVisibility.body.error.code).toBe('VALIDATION_ERROR');

    const followers = await request(app)
      .post('/api/me/wishlists')
      .set(authHeaders(auth, true))
      .send({ title: 'Для подписчиков', visibility: 'followers' });
    expect(followers.status).toBe(201);
    expect(followers.body.wishlist.visibility).toBe('followers');
  });

  it('требует авторизацию для операций владельца', async () => {
    const response = await request(app).get('/api/me/wishlists');
    expect(response.status).toBe(401);
  });
});

describe('подарки', () => {
  it('создаёт подарок со всеми полями и назначает порядок', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);

    const gift = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({
        title: 'Наушники',
        description: 'Беспроводные',
        links: ['https://shop.example.com/item/1', 'https://market.example.com/item/1'],
        priceMinor: 2999000,
        currency: 'RUB',
        priority: 1,
      });

    expect(gift.status).toBe(201);
    expect(gift.body.gift).toMatchObject({
      title: 'Наушники',
      description: 'Беспроводные',
      links: ['https://shop.example.com/item/1', 'https://market.example.com/item/1'],
      priceMinor: 2999000,
      currency: 'RUB',
      priority: 1,
      status: 'available',
      sortOrder: 0,
      booking: null,
    });
    expect(gift.body.gift).not.toHaveProperty('url');

    const second = await createGift(app, auth, wishlist.id, { title: 'Книга' });
    expect(second.sortOrder).toBe(1);

    const summary = await request(app).get('/api/me/wishlists').set(authHeaders(auth));
    expect(summary.body.wishlists[0].giftCount).toBe(2);

    const detail = await request(app).get(`/api/me/wishlists/${wishlist.id}`).set(authHeaders(auth));
    expect(detail.status).toBe(200);
    expect(detail.body.gifts).toHaveLength(2);
    expect(detail.body.gifts.map((item: { title: string }) => item.title)).toEqual([
      'Наушники',
      'Книга',
    ]);
  });

  it('частично обновляет подарок и очищает null/[] необязательные поля', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);
    const gift = await createGift(app, auth, wishlist.id, {
      description: 'Старое описание',
      links: ['https://shop.example.com/item/1'],
      priceMinor: 100,
    });

    const updated = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Обновлённый', description: null, links: [], priceMinor: null, priority: 5 });

    expect(updated.status).toBe(200);
    expect(updated.body.gift).toMatchObject({
      title: 'Обновлённый',
      description: null,
      links: [],
      priceMinor: null,
      priority: 5,
    });
  });

  it('валидирует ссылки и приоритет', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);

    const badUrl = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Подарок', links: ['ftp://example.com/file'] });
    expect(badUrl.status).toBe(400);
    expect(badUrl.body.error.code).toBe('VALIDATION_ERROR');

    const badPriority = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Подарок', priority: 6 });
    expect(badPriority.status).toBe(400);

    const emptyTitle = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: '   ' });
    expect(emptyTitle.status).toBe(400);
  });

  it('меняет порядок подарков', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);
    const first = await createGift(app, auth, wishlist.id, { title: 'Первый' });
    const second = await createGift(app, auth, wishlist.id, { title: 'Второй' });

    const reordered = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts/reorder`)
      .set(authHeaders(auth, true))
      .send({ order: [second.id, first.id] });
    expect(reordered.status).toBe(204);

    const detail = await request(app).get(`/api/me/wishlists/${wishlist.id}`).set(authHeaders(auth));
    expect(detail.body.gifts.map((item: { id: string }) => item.id)).toEqual([second.id, first.id]);
  });

  it('перемещает подарок в другой вишлист', async () => {
    const auth = await registerUser(app);
    const source = await createWishlist(app, auth, { title: 'Источник' });
    const target = await createWishlist(app, auth, { title: 'Цель' });
    const gift = await createGift(app, auth, source.id);

    const moved = await request(app)
      .post(`/api/me/gifts/${gift.id}/move`)
      .set(authHeaders(auth, true))
      .send({ wishlistId: target.id });
    expect(moved.status).toBe(200);
    expect(moved.body.gift.id).toBe(gift.id);

    const targetDetail = await request(app).get(`/api/me/wishlists/${target.id}`).set(authHeaders(auth));
    expect(targetDetail.body.gifts).toHaveLength(1);
    const sourceDetail = await request(app).get(`/api/me/wishlists/${source.id}`).set(authHeaders(auth));
    expect(sourceDetail.body.gifts).toHaveLength(0);
  });

  it('удаляет подарок', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);
    const gift = await createGift(app, auth, wishlist.id);

    const deleted = await request(app)
      .delete(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(204);

    const detail = await request(app).get(`/api/me/wishlists/${wishlist.id}`).set(authHeaders(auth));
    expect(detail.body.gifts).toHaveLength(0);
  });
});

describe('чужие объекты → 404 (не 403)', () => {
  it('не даёт читать и менять чужой вишлист и подарок', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app, {}, '10.0.0.9');
    const wishlist = await createWishlist(app, owner);
    const gift = await createGift(app, owner, wishlist.id);

    const requests = [
      request(app).get(`/api/me/wishlists/${wishlist.id}`).set(authHeaders(stranger)),
      request(app)
        .patch(`/api/me/wishlists/${wishlist.id}`)
        .set(authHeaders(stranger, true))
        .send({ title: 'Взлом' }),
      request(app).delete(`/api/me/wishlists/${wishlist.id}`).set(authHeaders(stranger, true)),
      request(app)
        .post(`/api/me/wishlists/${wishlist.id}/gifts`)
        .set(authHeaders(stranger, true))
        .send({ title: 'Чужой подарок' }),
      request(app).post(`/api/me/wishlists/${wishlist.id}/gifts/reorder`).set(authHeaders(stranger, true)).send({ order: [gift.id] }),
      request(app)
        .patch(`/api/me/gifts/${gift.id}`)
        .set(authHeaders(stranger, true))
        .send({ title: 'Взлом' }),
      request(app).delete(`/api/me/gifts/${gift.id}`).set(authHeaders(stranger, true)),
      request(app)
        .post(`/api/me/gifts/${gift.id}/status`)
        .set(authHeaders(stranger, true))
        .send({ status: 'gifted' }),
      request(app)
        .post(`/api/me/gifts/${gift.id}/move`)
        .set(authHeaders(stranger, true))
        .send({ wishlistId: wishlist.id }),
    ];

    const responses = await Promise.all(requests);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('не даёт менять порядок чужими идентификаторами', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app, {}, '10.0.0.10');
    const wishlist = await createWishlist(app, owner);

    const response = await request(app)
      .post('/api/me/wishlists/reorder')
      .set(authHeaders(stranger, true))
      .send({ order: [wishlist.id] });
    expect(response.status).toBe(404);
  });
});

describe('вишлисты в публичном профиле', () => {
  it('гость видит только публичные, владелец — все', async () => {
    const auth = await registerUser(app);
    const publicList = await createWishlist(app, auth, { title: 'Публичный', visibility: 'public' });
    const linkList = await createWishlist(app, auth, { title: 'По ссылке', visibility: 'link' });

    const anonymous = await request(app).get(`/api/users/${auth.user.username}`);
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.wishlists.map((item: { id: string }) => item.id)).toEqual([publicList.id]);

    const asOwner = await request(app).get(`/api/users/${auth.user.username}`).set(authHeaders(auth));
    expect(asOwner.body.wishlists).toHaveLength(2);
    expect(asOwner.body.wishlists.map((item: { id: string }) => item.id).sort()).toEqual(
      [publicList.id, linkList.id].sort(),
    );
  });
});

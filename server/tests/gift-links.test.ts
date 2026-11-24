import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
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

const LINK_A = 'https://shop.example.com/item-a';
const LINK_B = 'https://market.example.com/item-b';
const LINK_C = 'https://other.example.com/item-c';

function linkCount(giftId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM gift_links WHERE gift_id = ?')
    .get(giftId) as { count: number };
  return row.count;
}

async function createOwnerWishlist() {
  const auth = await registerUser(app);
  const wishlist = await createWishlist(app, auth, { title: 'Ссылки', visibility: 'link' });
  return { auth, wishlist };
}

describe('ссылки подарка (links)', () => {
  it('сохраняет несколько ссылок в порядке пользователя', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const created = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Плед', links: [LINK_B, LINK_A] });

    expect(created.status).toBe(201);
    expect(created.body.gift.links).toEqual([LINK_B, LINK_A]);
    expect(created.body.gift).not.toHaveProperty('url');
    expect(linkCount(created.body.gift.id)).toBe(2);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth));
    expect(detail.body.gifts[0].links).toEqual([LINK_B, LINK_A]);
  });

  it('удаляет дубликаты, сохраняя порядок первого вхождения', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const created = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Плед', links: [LINK_A, LINK_B, LINK_A, LINK_C, LINK_B] });

    expect(created.status).toBe(201);
    expect(created.body.gift.links).toEqual([LINK_A, LINK_B, LINK_C]);
    expect(linkCount(created.body.gift.id)).toBe(3);
  });

  it('PATCH с links заменяет весь список', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const gift = await createGift(app, auth, wishlist.id, { links: [LINK_A, LINK_B] });

    const patched = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ links: [LINK_C] });

    expect(patched.status).toBe(200);
    expect(patched.body.gift.links).toEqual([LINK_C]);
    expect(linkCount(gift.id)).toBe(1);
  });

  it('PATCH с links: [] очищает все ссылки', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const gift = await createGift(app, auth, wishlist.id, { links: [LINK_A, LINK_B] });

    const patched = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ links: [] });

    expect(patched.status).toBe(200);
    expect(patched.body.gift.links).toEqual([]);
    expect(linkCount(gift.id)).toBe(0);
  });

  it('PATCH без links не меняет список', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const gift = await createGift(app, auth, wishlist.id, { links: [LINK_A, LINK_B] });

    const patched = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Новое название' });

    expect(patched.status).toBe(200);
    expect(patched.body.gift.title).toBe('Новое название');
    expect(patched.body.gift.links).toEqual([LINK_A, LINK_B]);
  });

  it('ссылки сохраняются при смене статуса и переносе подарка', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const gift = await createGift(app, auth, wishlist.id, { links: [LINK_A] });
    const target = await createWishlist(app, auth, { title: 'Другой список' });

    const status = await request(app)
      .post(`/api/me/gifts/${gift.id}/status`)
      .set(authHeaders(auth, true))
      .send({ status: 'gifted' });
    expect(status.status).toBe(200);
    expect(status.body.gift.links).toEqual([LINK_A]);

    const moved = await request(app)
      .post(`/api/me/gifts/${gift.id}/move`)
      .set(authHeaders(auth, true))
      .send({ wishlistId: target.id });
    expect(moved.status).toBe(200);
    expect(moved.body.gift.links).toEqual([LINK_A]);
  });

  it('больше 10 ссылок → 400 VALIDATION_ERROR', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const eleven = Array.from({ length: 11 }, (_, index) => `https://example.com/item-${index}`);

    const created = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Слишком много', links: eleven });
    expect(created.status).toBe(400);
    expect(created.body.error.code).toBe('VALIDATION_ERROR');

    const other = await createGift(app, auth, wishlist.id);
    const patched = await request(app)
      .patch(`/api/me/gifts/${other.id}`)
      .set(authHeaders(auth, true))
      .send({ links: eleven });
    expect(patched.status).toBe(400);
    expect(patched.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('невалидные ссылки → 400 VALIDATION_ERROR', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const invalidVariants = [
      ['ftp://example.com/file'],
      ['not-a-url'],
      ['https://example.com/ok', 'javascript:alert(1)'],
      [''],
    ];

    for (const links of invalidVariants) {
      const response = await request(app)
        .post(`/api/me/wishlists/${wishlist.id}/gifts`)
        .set(authHeaders(auth, true))
        .send({ title: 'Подарок', links });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('links присутствуют и в виде владельца, и в публичном виде', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    await createGift(app, auth, wishlist.id, { links: [LINK_A, LINK_B] });

    const ownerDetail = await request(app)
      .get(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth));
    expect(ownerDetail.body.gifts[0].links).toEqual([LINK_A, LINK_B]);

    const publicView = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.gifts[0].links).toEqual([LINK_A, LINK_B]);
  });

  it('удаление подарка каскадно удаляет его ссылки', async () => {
    const { auth, wishlist } = await createOwnerWishlist();
    const gift = await createGift(app, auth, wishlist.id, { links: [LINK_A, LINK_B] });
    expect(linkCount(gift.id)).toBe(2);

    const deleted = await request(app)
      .delete(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(204);
    expect(linkCount(gift.id)).toBe(0);
  });
});

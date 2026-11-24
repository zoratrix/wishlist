import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
  bookRequest,
  createGift,
  createTestApp,
  createWishlist,
  registerUser,
  resetAll,
  unbookRequest,
  type AuthContext,
  type WishlistBody,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

const VISITOR = { name: 'Мария', email: 'maria@example.com' };

interface PrivacyFixture {
  auth: AuthContext;
  wishlist: WishlistBody;
  giftId: string;
  shareToken: string;
}

async function bookedFixture(showBooked: boolean, showBookerNames: boolean): Promise<PrivacyFixture> {
  const auth = await registerUser(app);
  const wishlist = await createWishlist(app, auth, { title: 'Приватный список', visibility: 'link' });
  if (showBooked) {
    const patched = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ showBooked: true, showBookerNames });
    expect(patched.status).toBe(200);
  }
  const gift = await createGift(app, auth, wishlist.id, { title: 'Наушники' });
  const booked = await bookRequest(app, wishlist.shareToken, gift.id, VISITOR);
  expect(booked.status).toBe(201);
  return { auth, wishlist, giftId: gift.id, shareToken: wishlist.shareToken };
}

async function ownerDetail(fixture: PrivacyFixture) {
  return request(app)
    .get(`/api/me/wishlists/${fixture.wishlist.id}`)
    .set(authHeaders(fixture.auth));
}

describe('приватность броней', () => {
  it('при showBooked=false владелец вообще не получает данных о брони', async () => {
    const fixture = await bookedFixture(false, false);
    const detail = await ownerDetail(fixture);

    expect(detail.status).toBe(200);
    expect(detail.body.wishlist.showBooked).toBe(false);
    expect(detail.body.gifts[0].booking).toBeNull();
    const giftText = JSON.stringify(detail.body.gifts[0]);
    expect(giftText).not.toContain('bookerName');
    expect(giftText).not.toContain('booked');

    const list = await request(app).get('/api/me/wishlists').set(authHeaders(fixture.auth));
    expect(list.body.wishlists[0].showBooked).toBe(false);
    expect(JSON.stringify(list.body)).not.toContain('booking');
  });

  it('при showBooked=true и showBookerNames=false — только факт «занято»', async () => {
    const fixture = await bookedFixture(true, false);
    const detail = await ownerDetail(fixture);

    expect(detail.body.gifts[0].booking).toEqual({ status: 'booked' });
    expect(detail.body.gifts[0].booking).not.toHaveProperty('bookerName');
    expect(Object.keys(detail.body.gifts[0].booking)).toEqual(['status']);
    expect(JSON.stringify(detail.body)).not.toContain(VISITOR.name);
    expect(JSON.stringify(detail.body)).not.toContain(VISITOR.email);
  });

  it('при showBooked=true и showBookerNames=true владелец видит только имя', async () => {
    const fixture = await bookedFixture(true, true);
    const detail = await ownerDetail(fixture);

    expect(detail.body.gifts[0].booking).toEqual({ status: 'booked', bookerName: 'Мария' });
    expect(Object.keys(detail.body.gifts[0].booking).sort()).toEqual(['bookerName', 'status']);
    expect(JSON.stringify(detail.body)).not.toContain(VISITOR.email);
  });

  it('гость никогда не видит имя бронирующего, даже если владелец включил показ', async () => {
    const fixture = await bookedFixture(true, true);

    const publicView = await request(app).get(`/api/w/${fixture.shareToken}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.gifts[0].booking).toEqual({ status: 'booked' });
    expect(publicView.body.gifts[0].booking).not.toHaveProperty('bookerName');
    expect(JSON.stringify(publicView.body)).not.toContain(VISITOR.name);
    expect(JSON.stringify(publicView.body)).not.toContain(VISITOR.email);
  });

  it('владелец, открывший свою ссылку без входа, видит гостевой вид', async () => {
    const fixture = await bookedFixture(true, true);
    const publicView = await request(app).get(`/api/w/${fixture.shareToken}`);
    expect(publicView.body.gifts[0].booking).toEqual({ status: 'booked' });
    expect(publicView.body.gifts[0].booking).not.toHaveProperty('bookerName');
  });

  it('email бронирующего не попадает ни в один ответ API', async () => {
    const fixture = await bookedFixture(true, true);
    const responses = [
      await request(app).get(`/api/w/${fixture.shareToken}`),
      await ownerDetail(fixture),
      await request(app).get('/api/me/wishlists').set(authHeaders(fixture.auth)),
      await bookRequest(app, fixture.shareToken, fixture.giftId, {
        name: 'Другой гость',
        email: 'second@example.com',
      }),
      await unbookRequest(app, fixture.shareToken, fixture.giftId, 'wrong@example.com'),
      await request(app)
        .patch(`/api/me/wishlists/${fixture.wishlist.id}`)
        .set(authHeaders(fixture.auth, true))
        .send({ title: 'Переименован' }),
    ];

    for (const response of responses) {
      const text = JSON.stringify(response.body);
      expect(text).not.toContain(VISITOR.email);
      expect(text).not.toContain('second@example.com');
      expect(text).not.toContain('wrong@example.com');
      // Даже владельцу email не отдаётся — только имя.
      expect(text).not.toContain('customer_email');
    }
  });

  it('после отмены бронь исчезает из обоих видов', async () => {
    const fixture = await bookedFixture(true, true);
    const cancelled = await unbookRequest(app, fixture.shareToken, fixture.giftId, VISITOR.email);
    expect(cancelled.status).toBe(200);

    const detail = await ownerDetail(fixture);
    expect(detail.body.gifts[0].booking).toBeNull();

    const publicView = await request(app).get(`/api/w/${fixture.shareToken}`);
    expect(publicView.body.gifts[0].booking).toBeNull();
  });

  it('объекты брони не содержат id, времени и email — только статус/имя', async () => {
    const fixture = await bookedFixture(true, true);
    const detail = await ownerDetail(fixture);
    const booking = detail.body.gifts[0].booking as Record<string, unknown>;

    expect(Object.keys(booking).sort()).toEqual(['bookerName', 'status']);
    expect(booking).not.toHaveProperty('id');
    expect(booking).not.toHaveProperty('email');
    expect(booking).not.toHaveProperty('createdAt');
  });
});

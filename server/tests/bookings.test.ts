import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
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
  type GiftBody,
  type WishlistBody,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

interface Fixture {
  auth: AuthContext;
  wishlist: WishlistBody;
  gift: GiftBody;
  shareToken: string;
}

async function ownerWithGift(showBooked = false, showBookerNames = false): Promise<Fixture> {
  const auth = await registerUser(app);
  const wishlist = await createWishlist(app, auth, { title: 'День рождения', visibility: 'link' });
  if (showBooked) {
    const patched = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ showBooked: true, showBookerNames });
    expect(patched.status).toBe(200);
  }
  const gift = await createGift(app, auth, wishlist.id, { title: 'Наушники' });
  return { auth, wishlist, gift, shareToken: wishlist.shareToken };
}

function activeBookingsCount(giftId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM bookings WHERE gift_id = ? AND cancelled_at IS NULL')
    .get(giftId) as { count: number };
  return row.count;
}

describe('публичная страница вишлиста', () => {
  it('отдаёт вишлист и подарки без лишних данных', async () => {
    const { auth, wishlist, gift, shareToken } = await ownerWithGift();

    const response = await request(app).get(`/api/w/${shareToken}`);
    expect(response.status).toBe(200);
    expect(response.body.wishlist).toMatchObject({
      id: wishlist.id,
      title: 'День рождения',
      visibility: 'link',
      owner: { username: auth.user.username, displayName: 'Тестовый пользователь', isProfilePublic: true },
    });
    expect(response.body.wishlist).not.toHaveProperty('showBooked');
    expect(response.body.gifts).toHaveLength(1);
    expect(response.body.gifts[0].id).toBe(gift.id);
    expect(response.body.gifts[0].booking).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain(auth.email);
  });

  it('на неизвестный токен и скрытый вишлист отвечает 404', async () => {
    const unknown = await request(app).get('/api/w/no-such-token');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');

    const { wishlist } = await ownerWithGift();
    getDb().prepare("UPDATE wishlists SET visibility = 'followers' WHERE id = ?").run(wishlist.id);
    const hidden = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('NOT_FOUND');
  });
});

describe('бронирование', () => {
  it('бронирует подарок, не раскрывая email бронирующего', async () => {
    const { gift, shareToken } = await ownerWithGift();
    const visitor = { name: 'Мария', email: 'Maria@Example.COM' };

    const response = await bookRequest(app, shareToken, gift.id, visitor);
    expect(response.status).toBe(201);
    expect(typeof response.body.booking.createdAt).toBe('string');
    expect(Object.keys(response.body.booking)).toEqual(['createdAt']);
    expect(JSON.stringify(response.body)).not.toContain(visitor.email.toLowerCase());
    expect(JSON.stringify(response.body)).not.toContain('maria@example.com');

    expect(activeBookingsCount(gift.id)).toBe(1);
    const stored = getDb()
      .prepare('SELECT customer_email_norm FROM bookings WHERE gift_id = ?')
      .get(gift.id) as { customer_email_norm: string };
    expect(stored.customer_email_norm).toBe('maria@example.com');

    const publicView = await request(app).get(`/api/w/${shareToken}`);
    expect(publicView.body.gifts[0].booking).toEqual({ status: 'booked' });
    expect(publicView.body.gifts[0].booking).not.toHaveProperty('bookerName');

    // В журнале попыток — только хеши, без открытых email/IP.
    const attempt = getDb()
      .prepare("SELECT email_hash, ip_hash FROM booking_attempts WHERE gift_id = ? AND action = 'book'")
      .get(gift.id) as { email_hash: string; ip_hash: string };
    expect(attempt.email_hash).toHaveLength(64);
    expect(attempt.ip_hash).toHaveLength(64);
    expect(attempt.email_hash).not.toContain('maria');
    expect(attempt.ip_hash).not.toContain('127.0.0.1');
  });

  it('авторизованному гостю бронирование не требует CSRF (гостевой запрос)', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { title: 'Свой список', visibility: 'link' });
    const gift = await createGift(app, auth, wishlist.id);

    const response = await request(app)
      .post(`/api/w/${wishlist.shareToken}/gifts/${gift.id}/book`)
      .set('Cookie', auth.cookie)
      .send({ name: 'Владелец', email: 'owner-guest@example.com' });

    expect(response.status).toBe(201);
    expect(response.body.booking).toHaveProperty('createdAt');
  });

  it('повторное бронирование того же подарка → 409 GIFT_ALREADY_BOOKED', async () => {
    const { gift, shareToken } = await ownerWithGift();
    const first = await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: 'maria@example.com' });
    expect(first.status).toBe(201);

    const second = await bookRequest(app, shareToken, gift.id, { name: 'Иван', email: 'ivan@example.com' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('GIFT_ALREADY_BOOKED');
    expect(second.body.error.message).toContain('уже забронировали');
    expect(activeBookingsCount(gift.id)).toBe(1);
  });

  it('два одновременных запроса дают ровно одну бронь', async () => {
    const { gift, shareToken } = await ownerWithGift();

    const [first, second] = await Promise.all([
      bookRequest(app, shareToken, gift.id, { name: 'Первый', email: 'one@example.com' }, '10.20.0.1'),
      bookRequest(app, shareToken, gift.id, { name: 'Второй', email: 'two@example.com' }, '10.20.0.2'),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(activeBookingsCount(gift.id)).toBe(1);
  });

  it('не бронирует чужой подарок по чужому токену (404)', async () => {
    const { shareToken } = await ownerWithGift();
    const otherAuth = await registerUser(app, {}, '10.0.0.7');
    const otherWishlist = await createWishlist(app, otherAuth, { title: 'Другой список' });
    const foreignGift = await createGift(app, otherAuth, otherWishlist.id);

    const response = await bookRequest(app, shareToken, foreignGift.id, {
      name: 'Мария',
      email: 'maria@example.com',
    });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('валидирует имя и email', async () => {
    const { gift, shareToken } = await ownerWithGift();

    const badEmail = await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: 'не-email' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe('VALIDATION_ERROR');

    const emptyName = await bookRequest(app, shareToken, gift.id, { name: '   ', email: 'maria@example.com' });
    expect(emptyName.status).toBe(400);
  });

  it('ограничивает бронирование: 30 в час на IP, 31-е — 429', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { title: 'Много подарков', visibility: 'link' });
    const giftIds: string[] = [];
    for (let index = 0; index < 31; index += 1) {
      const gift = await createGift(app, auth, wishlist.id, { title: `Подарок ${index}` });
      giftIds.push(gift.id);
    }

    const ip = '10.30.0.1';
    for (let index = 0; index < 30; index += 1) {
      const giftId = giftIds[index];
      if (giftId === undefined) throw new Error('нет подарка');
      const response = await bookRequest(app, wishlist.shareToken, giftId, {
        name: `Гость ${index}`,
        email: `guest_${index}@example.com`,
      }, ip);
      expect(response.status).toBe(201);
    }

    const lastGiftId = giftIds[30];
    if (lastGiftId === undefined) throw new Error('нет подарка');
    const blocked = await bookRequest(app, wishlist.shareToken, lastGiftId, {
      name: 'Лишний гость',
      email: 'extra@example.com',
    }, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('отмена бронирования', () => {
  it('отменяет бронь по своему email и разрешает новую бронь', async () => {
    const { gift, shareToken } = await ownerWithGift();
    await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: ' Maria@Example.COM ' });

    const cancelled = await unbookRequest(app, shareToken, gift.id, ' guest@example.com ');
    expect(cancelled.status).toBe(400);
    // Проверяем именно нормализацию: тот же адрес в другом регистре/с пробелами.
    const success = await unbookRequest(app, shareToken, gift.id, '  MARIA@example.com ');
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ ok: true });

    expect(activeBookingsCount(gift.id)).toBe(0);
    const publicView = await request(app).get(`/api/w/${shareToken}`);
    expect(publicView.body.gifts[0].booking).toBeNull();

    const rebooked = await bookRequest(app, shareToken, gift.id, { name: 'Иван', email: 'ivan@example.com' });
    expect(rebooked.status).toBe(201);
  });

  it('не отличает «брони нет» от «email не тот»: одинаковый 400', async () => {
    const { gift, shareToken } = await ownerWithGift();

    const noBooking = await unbookRequest(app, shareToken, gift.id, 'maria@example.com');
    expect(noBooking.status).toBe(400);
    expect(noBooking.body.error.code).toBe('UNBOOK_FAILED');

    await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: 'maria@example.com' });
    const wrongEmail = await unbookRequest(app, shareToken, gift.id, 'other@example.com');
    expect(wrongEmail.status).toBe(400);
    expect(wrongEmail.body.error.code).toBe('UNBOOK_FAILED');

    expect(wrongEmail.body.error.code).toBe(noBooking.body.error.code);
    expect(wrongEmail.body.error.message).toBe(noBooking.body.error.message);
    expect(activeBookingsCount(gift.id)).toBe(1);
  });

  it('ограничивает отмену: 10 неудачных попыток на подарок, 11-я — 429', async () => {
    const { gift, shareToken } = await ownerWithGift();
    await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: 'maria@example.com' });

    for (let index = 0; index < 10; index += 1) {
      const response = await unbookRequest(app, shareToken, gift.id, `wrong_${index}@example.com`);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNBOOK_FAILED');
    }

    const blocked = await unbookRequest(app, shareToken, gift.id, 'maria@example.com');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(activeBookingsCount(gift.id)).toBe(1);
  });
});

describe('статус «подарен»', () => {
  it('закрывает активную бронь и запрещает новую', async () => {
    const { auth, gift, shareToken } = await ownerWithGift(true, true);
    await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: 'maria@example.com' });

    const gifted = await request(app)
      .post(`/api/me/gifts/${gift.id}/status`)
      .set(authHeaders(auth, true))
      .send({ status: 'gifted' });
    expect(gifted.status).toBe(200);
    expect(gifted.body.gift.status).toBe('gifted');
    expect(gifted.body.gift.booking).toBeNull();

    const booking = getDb()
      .prepare('SELECT cancelled_at, cancelled_reason FROM bookings WHERE gift_id = ?')
      .get(gift.id) as { cancelled_at: string | null; cancelled_reason: string | null };
    expect(booking.cancelled_at).not.toBeNull();
    expect(booking.cancelled_reason).toBe('owner_gifted');

    const publicView = await request(app).get(`/api/w/${shareToken}`);
    expect(publicView.body.gifts[0].status).toBe('gifted');
    expect(publicView.body.gifts[0].booking).toBeNull();

    const attempt = await bookRequest(app, shareToken, gift.id, {
      name: 'Поздний гость',
      email: 'late@example.com',
    });
    expect(attempt.status).toBe(422);
    expect(attempt.body.error.code).toBe('GIFT_GIFTED');
  });

  it('возврат в available разрешает новую бронь (старая не восстанавливается)', async () => {
    const { auth, gift, shareToken } = await ownerWithGift(true, false);
    await bookRequest(app, shareToken, gift.id, { name: 'Мария', email: 'maria@example.com' });
    await request(app)
      .post(`/api/me/gifts/${gift.id}/status`)
      .set(authHeaders(auth, true))
      .send({ status: 'gifted' });

    const available = await request(app)
      .post(`/api/me/gifts/${gift.id}/status`)
      .set(authHeaders(auth, true))
      .send({ status: 'available' });
    expect(available.status).toBe(200);
    expect(available.body.gift.status).toBe('available');
    expect(available.body.gift.booking).toBeNull();

    const rebooked = await bookRequest(app, shareToken, gift.id, { name: 'Иван', email: 'ivan@example.com' });
    expect(rebooked.status).toBe(201);

    const visitor = getDb()
      .prepare(
        "SELECT COUNT(*) AS count FROM bookings WHERE gift_id = ? AND cancelled_reason = 'visitor'",
      )
      .get(gift.id) as { count: number };
    // Отмену по причине owner_gifted не переписываем на visitor.
    expect(visitor.count).toBe(0);
  });
});

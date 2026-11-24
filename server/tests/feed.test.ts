import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import { nextBirthdayOccurrence } from '../src/modules/feed/feed.service.ts';
import {
  authHeaders,
  createTestApp,
  createWishlist,
  registerUser,
  resetAll,
  type AuthContext,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

function setWishlistCreatedAt(wishlistId: string, createdAt: string): void {
  getDb().prepare('UPDATE wishlists SET created_at = ? WHERE id = ?').run(createdAt, wishlistId);
}

async function follow(appInstance: Express, follower: AuthContext, target: AuthContext): Promise<void> {
  const response = await request(appInstance)
    .post(`/api/users/${target.user.username}/follow`)
    .set(authHeaders(follower, true));
  expect(response.status).toBe(200);
}

async function setBirthday(auth: AuthContext, date: Date): Promise<void> {
  const response = await request(app)
    .patch('/api/me/profile')
    .set(authHeaders(auth, true))
    .send({ birthMonth: date.getMonth() + 1, birthDay: date.getDate() });
  expect(response.status).toBe(200);
}

async function getFeed(auth: AuthContext) {
  return request(app).get('/api/me/feed').set('Cookie', auth.cookie);
}

describe('GET /api/me/feed — вишлисты подписок', () => {
  it('пустая лента у пользователя без подписок', async () => {
    const auth = await registerUser(app);
    const response = await getFeed(auth);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [] });
  });

  it('требует авторизации', async () => {
    const response = await request(app).get('/api/me/feed');
    expect(response.status).toBe(401);
  });

  it('показывает свежие public/followers вишлисты подписок, кроме link, старых и чужих', async () => {
    const viewer = await registerUser(app);
    const authorA = await registerUser(app, {}, '10.9.0.1');
    const authorB = await registerUser(app, {}, '10.9.0.2');
    const outsider = await registerUser(app, {}, '10.9.0.3');

    await follow(app, viewer, authorA);
    await follow(app, viewer, authorB);

    const aPublic = await createWishlist(app, authorA, {
      title: 'A public',
      visibility: 'public',
    });
    const aLink = await createWishlist(app, authorA, { title: 'A link', visibility: 'link' });
    const aOld = await createWishlist(app, authorA, { title: 'A old', visibility: 'public' });
    const bFollowers = await createWishlist(app, authorB, {
      title: 'B followers',
      visibility: 'followers',
    });
    const cPublic = await createWishlist(app, outsider, { title: 'C public', visibility: 'public' });

    setWishlistCreatedAt(aPublic.id, isoDaysAgo(2 / 24));
    setWishlistCreatedAt(aLink.id, isoDaysAgo(1 / 24));
    setWishlistCreatedAt(aOld.id, isoDaysAgo(61));
    setWishlistCreatedAt(bFollowers.id, isoDaysAgo(1 / 24));
    setWishlistCreatedAt(cPublic.id, isoDaysAgo(0));

    const response = await getFeed(viewer);
    expect(response.status).toBe(200);
    const items = response.body.items as Array<Record<string, unknown>>;
    expect(items.map((item) => item.type)).toEqual(['wishlist', 'wishlist']);

    const titles = items.map(
      (item) => (item.wishlist as { title: string }).title,
    );
    expect(titles).toEqual(['B followers', 'A public']);

    const first = items[0] as {
      type: string;
      at: string;
      wishlist: {
        id: string;
        title: string;
        shareToken: string;
        owner: { username: string; displayName: string; avatarPath: string | null };
      };
    };
    expect(first.type).toBe('wishlist');
    expect(first.wishlist.id).toBe(bFollowers.id);
    expect(first.wishlist.shareToken).toBe(bFollowers.shareToken);
    expect(first.wishlist.owner.username).toBe(authorB.user.username);
    expect(first.wishlist.owner).toHaveProperty('displayName');
    expect(first.wishlist.owner.avatarPath).toBeNull();
    expect(typeof first.at).toBe('string');

    const serialized = JSON.stringify(items);
    expect(serialized).not.toContain(aLink.id);
    expect(serialized).not.toContain(aOld.id);
    expect(serialized).not.toContain(cPublic.id);
    // Email авторов в ленте не нужен.
    expect(serialized).not.toContain(authorA.email);
  });
});

describe('GET /api/me/feed — дни рождения подписок', () => {
  it('показывает ДР в ближайшие 30 дней, сортирует по близости, исключает дальние', async () => {
    const viewer = await registerUser(app);
    const todayAuthor = await registerUser(app, {}, '10.10.0.1');
    const soonAuthor = await registerUser(app, {}, '10.10.0.2');
    const edgeAuthor = await registerUser(app, {}, '10.10.0.3');
    const farAuthor = await registerUser(app, {}, '10.10.0.4');

    await follow(app, viewer, todayAuthor);
    await follow(app, viewer, soonAuthor);
    await follow(app, viewer, edgeAuthor);
    await follow(app, viewer, farAuthor);

    const today = new Date();
    await setBirthday(todayAuthor, today);
    await setBirthday(soonAuthor, addDays(today, 5));
    await setBirthday(edgeAuthor, addDays(today, 30));
    await setBirthday(farAuthor, addDays(today, 31));

    const response = await getFeed(viewer);
    expect(response.status).toBe(200);
    const items = response.body.items as Array<{
      type: string;
      at: string;
      date: string;
      inDays: number;
      user: { username: string; displayName: string; avatarPath: string | null };
    }>;
    expect(items.map((item) => item.type)).toEqual(['birthday', 'birthday', 'birthday']);
    expect(items.map((item) => item.inDays)).toEqual([0, 5, 30]);
    expect(items.map((item) => item.user.username)).toEqual([
      todayAuthor.user.username,
      soonAuthor.user.username,
      edgeAuthor.user.username,
    ]);

    const soonDate = addDays(today, 5);
    const expectedDate = `${String(soonDate.getMonth() + 1).padStart(2, '0')}-${String(soonDate.getDate()).padStart(2, '0')}`;
    expect(items[1]?.date).toBe(expectedDate);
    expect(typeof items[0]?.at).toBe('string');
    expect(JSON.stringify(items)).not.toContain(farAuthor.user.username);
  });

  it('29.02 в невисокосный год считается 28.02', () => {
    const nonLeapToday = new Date(2027, 1, 20); // 20 февраля 2027 (невисокосный)
    expect(nextBirthdayOccurrence(2, 29, nonLeapToday)).toMatchObject({
      date: '02-28',
      inDays: 8,
    });

    const leapToday = new Date(2028, 1, 20); // 2028 — високосный
    expect(nextBirthdayOccurrence(2, 29, leapToday)).toMatchObject({
      date: '02-29',
      inDays: 9,
    });

    // В сам «заменённый» день рождения — 0 дней.
    expect(nextBirthdayOccurrence(2, 29, new Date(2027, 1, 28))).toMatchObject({
      date: '02-28',
      inDays: 0,
    });

    // После 28.02.2027 ближайший ДР только в 2028 — дальше окна 30 дней.
    expect(nextBirthdayOccurrence(2, 29, new Date(2027, 2, 1))).toBeNull();
  });
});

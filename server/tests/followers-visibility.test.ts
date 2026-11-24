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
  type AuthContext,
  type WishlistBody,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

async function makeUsers(): Promise<{ owner: AuthContext; stranger: AuthContext }> {
  const owner = await registerUser(app);
  const stranger = await registerUser(app, {}, '10.4.0.1');
  return { owner, stranger };
}

async function follow(appInstance: Express, follower: AuthContext, target: AuthContext) {
  const response = await request(appInstance)
    .post(`/api/users/${target.user.username}/follow`)
    .set(authHeaders(follower, true));
  expect(response.status).toBe(200);
}

async function profileWishlistIds(
  appInstance: Express,
  username: string,
  viewer: AuthContext | null,
): Promise<string[]> {
  const requestBuilder = request(appInstance).get(`/api/users/${username}`);
  if (viewer !== null) requestBuilder.set('Cookie', viewer.cookie);
  const response = await requestBuilder;
  expect(response.status).toBe(200);
  return (response.body.wishlists as WishlistBody[]).map((wishlist) => wishlist.id);
}

describe('вишлисты в публичном профиле', () => {
  it('public — всем, followers — подписчикам, link — только по ссылке', async () => {
    const { owner, stranger } = await makeUsers();
    const publicList = await createWishlist(app, owner, { title: 'Публичный', visibility: 'public' });
    const followersList = await createWishlist(app, owner, {
      title: 'Для подписчиков',
      visibility: 'followers',
    });
    const linkList = await createWishlist(app, owner, { title: 'По ссылке', visibility: 'link' });

    expect(await profileWishlistIds(app, owner.user.username, null)).toEqual([publicList.id]);
    expect(await profileWishlistIds(app, owner.user.username, stranger)).toEqual([publicList.id]);

    await follow(app, stranger, owner);
    expect(await profileWishlistIds(app, owner.user.username, stranger)).toEqual([
      publicList.id,
      followersList.id,
    ]);

    expect(await profileWishlistIds(app, owner.user.username, owner)).toEqual([
      publicList.id,
      followersList.id,
      linkList.id,
    ]);
  });

  it('link-список не появляется в профиле даже у подписчика', async () => {
    const { owner, stranger } = await makeUsers();
    const linkList = await createWishlist(app, owner, { title: 'Секретная ссылка', visibility: 'link' });
    await follow(app, stranger, owner);

    const ids = await profileWishlistIds(app, owner.user.username, stranger);
    expect(ids).not.toContain(linkList.id);
  });
});

describe('доступ к followers-вишлисту по ссылке', () => {
  async function followersWishlistFixture(): Promise<{
    owner: AuthContext;
    stranger: AuthContext;
    wishlist: WishlistBody;
    giftId: string;
  }> {
    const { owner, stranger } = await makeUsers();
    const wishlist = await createWishlist(app, owner, {
      title: 'Только подписчикам',
      visibility: 'followers',
    });
    const gift = await createGift(app, owner, wishlist.id, { title: 'Подарок' });
    return { owner, stranger, wishlist, giftId: gift.id };
  }

  it('гость и не-подписчик получают 404, подписчик и владелец — 200', async () => {
    const { owner, stranger, wishlist } = await followersWishlistFixture();
    const token = wishlist.shareToken;

    const guest = await request(app).get(`/api/w/${token}`);
    expect(guest.status).toBe(404);
    expect(guest.body.error.code).toBe('NOT_FOUND');

    const notFollower = await request(app)
      .get(`/api/w/${token}`)
      .set(authHeaders(stranger));
    expect(notFollower.status).toBe(404);

    const ownerView = await request(app)
      .get(`/api/w/${token}`)
      .set(authHeaders(owner));
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.wishlist.id).toBe(wishlist.id);

    // Владелец без входа — гость, доступа нет.
    const ownerAsGuest = await request(app).get(`/api/w/${token}`);
    expect(ownerAsGuest.status).toBe(404);

    await follow(app, stranger, owner);
    const followerView = await request(app)
      .get(`/api/w/${token}`)
      .set(authHeaders(stranger));
    expect(followerView.status).toBe(200);

    await request(app)
      .delete(`/api/users/${owner.user.username}/follow`)
      .set(authHeaders(stranger, true));
    const afterUnfollow = await request(app)
      .get(`/api/w/${token}`)
      .set(authHeaders(stranger));
    expect(afterUnfollow.status).toBe(404);
  });

  it('бронирование по ссылке followers-списка доступно только своим', async () => {
    const { owner, stranger, wishlist, giftId } = await followersWishlistFixture();
    const visitor = { name: 'Гость', email: 'guest@example.com' };

    const guestBooking = await bookRequest(app, wishlist.shareToken, giftId, visitor);
    expect(guestBooking.status).toBe(404);

    await follow(app, stranger, owner);
    // Бронирование по ссылке — гостевой запрос, но доступ проверяется по сессии:
    // передаём cookie подписчика (CSRF для бронирования не требуется).
    const followerBooking = await request(app)
      .post(`/api/w/${wishlist.shareToken}/gifts/${giftId}/book`)
      .set(authHeaders(stranger))
      .send(visitor);
    expect(followerBooking.status).toBe(201);
  });

  it('public и link по-прежнему открываются гостю без входа', async () => {
    const { owner } = await makeUsers();
    const publicList = await createWishlist(app, owner, { title: 'Публичный', visibility: 'public' });
    const linkList = await createWishlist(app, owner, { title: 'По ссылке', visibility: 'link' });

    for (const wishlist of [publicList, linkList]) {
      const response = await request(app).get(`/api/w/${wishlist.shareToken}`);
      expect(response.status).toBe(200);
      expect(response.body.wishlist.id).toBe(wishlist.id);
    }
  });

  it('смена видимости на followers сразу закрывает гостевой доступ', async () => {
    const { owner } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { title: 'Сначала публичный', visibility: 'public' });
    expect((await request(app).get(`/api/w/${wishlist.shareToken}`)).status).toBe(200);

    const patched = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(owner, true))
      .send({ visibility: 'followers' });
    expect(patched.status).toBe(200);
    expect(patched.body.wishlist.visibility).toBe('followers');
    expect((await request(app).get(`/api/w/${wishlist.shareToken}`)).status).toBe(404);
  });
});

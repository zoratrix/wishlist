import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
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

async function makeUsers(): Promise<{ owner: AuthContext; stranger: AuthContext }> {
  const owner = await registerUser(app, {}, '10.9.0.1');
  const stranger = await registerUser(app, {}, '10.9.0.2');
  return { owner, stranger };
}

async function follow(follower: AuthContext, target: AuthContext): Promise<void> {
  const response = await request(app)
    .post(`/api/users/${target.user.username}/follow`)
    .set(authHeaders(follower, true));
  expect(response.status).toBe(200);
  expect(response.body.isFollowing).toBe(true);
}

async function closeProfile(auth: AuthContext): Promise<void> {
  const response = await request(app)
    .patch('/api/me/profile')
    .set(authHeaders(auth, true))
    .send({ isProfilePublic: false });
  expect(response.status).toBe(200);
}

/** GET /api/w/:shareToken от имени гостя (viewer=null) или пользователя. */
function publicWishlistRequest(token: string, viewer: AuthContext | null) {
  const builder = request(app).get(`/api/w/${token}`);
  if (viewer !== null) builder.set(authHeaders(viewer));
  return builder;
}

const GUEST_VIEWER = { isSelf: false, isFollowing: false, canFollow: false };

describe('viewer в гостевой странице вишлиста', () => {
  it('гость: не владелец, не подписан, подписаться нельзя', async () => {
    const { owner } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { visibility: 'link' });

    const response = await publicWishlistRequest(wishlist.shareToken, null);
    expect(response.status).toBe(200);
    // Прежние поля ответа не меняются — viewer добавлен рядом с ними.
    expect(response.body.wishlist.id).toBe(wishlist.id);
    expect(Array.isArray(response.body.gifts)).toBe(true);
    expect(Array.isArray(response.body.categories)).toBe(true);
    expect(response.body.viewer).toEqual(GUEST_VIEWER);
  });

  it('залогиненный не-подписчик открытого профиля: canFollow = true', async () => {
    const { owner, stranger } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { visibility: 'link' });

    const response = await publicWishlistRequest(wishlist.shareToken, stranger);
    expect(response.status).toBe(200);
    expect(response.body.viewer).toEqual({ isSelf: false, isFollowing: false, canFollow: true });
  });

  it('подписчик: isFollowing = true, canFollow = false', async () => {
    const { owner, stranger } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { visibility: 'link' });
    await follow(stranger, owner);

    const response = await publicWishlistRequest(wishlist.shareToken, stranger);
    expect(response.status).toBe(200);
    expect(response.body.viewer).toEqual({ isSelf: false, isFollowing: true, canFollow: false });
  });

  it('владелец: isSelf = true', async () => {
    const { owner } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { visibility: 'link' });

    const response = await publicWishlistRequest(wishlist.shareToken, owner);
    expect(response.status).toBe(200);
    expect(response.body.viewer).toEqual({ isSelf: true, isFollowing: false, canFollow: false });
  });

  it('viewer гостевой страницы совпадает с viewer публичного профиля', async () => {
    const { owner, stranger } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { visibility: 'public' });

    async function profileViewer(viewer: AuthContext | null) {
      const builder = request(app).get(`/api/users/${owner.user.username}`);
      if (viewer !== null) builder.set(authHeaders(viewer));
      const response = await builder;
      expect(response.status).toBe(200);
      return response.body.viewer as unknown;
    }

    for (const viewer of [null, stranger, owner]) {
      const guestPage = await publicWishlistRequest(wishlist.shareToken, viewer);
      expect(guestPage.status).toBe(200);
      expect(guestPage.body.viewer).toEqual(await profileViewer(viewer));
    }

    await follow(stranger, owner);
    const followerPage = await publicWishlistRequest(wishlist.shareToken, stranger);
    expect(followerPage.body.viewer).toEqual(await profileViewer(stranger));
    expect(followerPage.body.viewer.isFollowing).toBe(true);
  });

  it('закрытый профиль при visibility=link: ссылка открывается, canFollow = false', async () => {
    const { owner, stranger } = await makeUsers();
    const wishlist = await createWishlist(app, owner, { visibility: 'link' });
    await closeProfile(owner);

    // Ссылка работает и для гостя, и для залогиненного не-подписчика,
    // но подписаться на закрытый профиль нельзя.
    for (const viewer of [null, stranger]) {
      const response = await publicWishlistRequest(wishlist.shareToken, viewer);
      expect(response.status).toBe(200);
      expect(response.body.wishlist.id).toBe(wishlist.id);
      expect(response.body.viewer).toEqual(GUEST_VIEWER);
    }

    const ownerView = await publicWishlistRequest(wishlist.shareToken, owner);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.viewer).toEqual({ isSelf: true, isFollowing: false, canFollow: false });

    // Публичный профиль закрыт: не-подписчику по-прежнему 404.
    const closedProfile = await request(app)
      .get(`/api/users/${owner.user.username}`)
      .set(authHeaders(stranger));
    expect(closedProfile.status).toBe(404);
  });
});

describe('viewer у followers-списка', () => {
  it('подписчик видит список и isFollowing = true; гостю и не-подписчику — 404', async () => {
    const { owner, stranger } = await makeUsers();
    const wishlist = await createWishlist(app, owner, {
      title: 'Только подписчикам',
      visibility: 'followers',
    });

    const guest = await publicWishlistRequest(wishlist.shareToken, null);
    expect(guest.status).toBe(404);

    const notFollower = await publicWishlistRequest(wishlist.shareToken, stranger);
    expect(notFollower.status).toBe(404);

    await follow(stranger, owner);
    const follower = await publicWishlistRequest(wishlist.shareToken, stranger);
    expect(follower.status).toBe(200);
    expect(follower.body.viewer).toEqual({ isSelf: false, isFollowing: true, canFollow: false });

    const ownerView = await publicWishlistRequest(wishlist.shareToken, owner);
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.viewer).toEqual({ isSelf: true, isFollowing: false, canFollow: false });
  });
});

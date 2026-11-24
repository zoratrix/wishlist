import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import {
  authHeaders,
  createTestApp,
  registerUser,
  resetAll,
  type AuthContext,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

function followCount(followerId: string, followingId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(followerId, followingId) as { count: number };
  return row.count;
}

async function me(appInstance: Express, auth: AuthContext) {
  return request(appInstance).get('/api/auth/me').set('Cookie', auth.cookie);
}

describe('подписка и отписка', () => {
  it('подписка односторонняя и идемпотентная', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.1.0.1');

    const first = await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ isFollowing: true });
    expect(followCount(boris.user.id, anna.user.id)).toBe(1);

    const repeat = await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));
    expect(repeat.status).toBe(200);
    expect(repeat.body).toEqual({ isFollowing: true });
    expect(followCount(boris.user.id, anna.user.id)).toBe(1);

    const annaMe = await me(app, anna);
    expect(annaMe.body.user.followersCount).toBe(1);
    expect(annaMe.body.user.followingCount).toBe(0);
    const borisMe = await me(app, boris);
    expect(borisMe.body.user.followersCount).toBe(0);
    expect(borisMe.body.user.followingCount).toBe(1);

    const profile = await request(app)
      .get(`/api/users/${anna.user.username}`)
      .set(authHeaders(boris));
    expect(profile.body.viewer).toEqual({ isSelf: false, isFollowing: true, canFollow: false });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const unfollow = await request(app)
        .delete(`/api/users/${anna.user.username}/follow`)
        .set(authHeaders(boris, true));
      expect(unfollow.status).toBe(200);
      expect(unfollow.body).toEqual({ isFollowing: false });
    }
    expect(followCount(boris.user.id, anna.user.id)).toBe(0);
  });

  it('на себя подписаться нельзя (400 CANNOT_FOLLOW_SELF)', async () => {
    const anna = await registerUser(app);
    const response = await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(anna, true));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_FOLLOW_SELF');
  });

  it('на закрытый профиль нельзя (404), на несуществующего — 404', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.1.0.2');
    await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(anna, true))
      .send({ isProfilePublic: false });

    const closed = await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));
    expect(closed.status).toBe(404);
    expect(closed.body.error.code).toBe('NOT_FOUND');

    const missing = await request(app)
      .post('/api/users/no_such_user_xyz/follow')
      .set(authHeaders(boris, true));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('подписка требует авторизации', async () => {
    const anna = await registerUser(app);
    const response = await request(app).post(`/api/users/${anna.user.username}/follow`);
    expect(response.status).toBe(401);
  });

  it('у закрытого профиля существующие подписки сохраняются', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.1.0.3');
    await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));
    await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(anna, true))
      .send({ isProfilePublic: false });

    const annaMe = await me(app, anna);
    expect(annaMe.body.user.followersCount).toBe(1);
    const borisFollowing = await request(app)
      .get('/api/me/following')
      .set(authHeaders(boris));
    expect(borisFollowing.body.users.map((user: { id: string }) => user.id)).toEqual([
      anna.user.id,
    ]);
  });
});

describe('списки подписчиков и подписок', () => {
  it('отдаёт FollowUserDTO с датой подписки, свежие сверху; только владельцу', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.2.0.1');
    const vera = await registerUser(app, {}, '10.2.0.2');

    await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(vera, true));
    await request(app)
      .post(`/api/users/${vera.user.username}/follow`)
      .set(authHeaders(anna, true));

    const followers = await request(app).get('/api/me/followers').set(authHeaders(anna));
    expect(followers.status).toBe(200);
    expect(followers.body.total).toBe(2);
    expect(followers.body.users.map((user: { username: string }) => user.username)).toEqual([
      vera.user.username,
      boris.user.username,
    ]);
    const first = followers.body.users[0] as Record<string, unknown>;
    expect(Object.keys(first).sort()).toEqual([
      'avatarPath',
      'bio',
      'displayName',
      'followedAt',
      'id',
      'username',
    ]);
    expect(typeof first.followedAt).toBe('string');
    expect(JSON.stringify(followers.body)).not.toContain(anna.email);

    const following = await request(app).get('/api/me/following').set('Cookie', anna.cookie);
    expect(following.body.total).toBe(1);
    expect(following.body.users[0].username).toBe(vera.user.username);

    const guest = await request(app).get('/api/me/followers');
    expect(guest.status).toBe(401);
  });

  it('владелец удаляет подписчика; чужие/несуществующие → 404', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.2.0.3');
    const vera = await registerUser(app, {}, '10.2.0.4');
    await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));

    // Вера не может удалить подписчика Анны через свой список.
    const foreign = await request(app)
      .delete(`/api/me/followers/${boris.user.id}`)
      .set(authHeaders(vera, true));
    expect(foreign.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/me/followers/${boris.user.id}`)
      .set(authHeaders(anna, true));
    expect(removed.status).toBe(204);
    expect(followCount(boris.user.id, anna.user.id)).toBe(0);

    const repeat = await request(app)
      .delete(`/api/me/followers/${boris.user.id}`)
      .set(authHeaders(anna, true));
    expect(repeat.status).toBe(404);

    const withoutCsrf = await request(app)
      .delete(`/api/me/followers/${vera.user.id}`)
      .set('Cookie', anna.cookie);
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.error.code).toBe('CSRF_FAILED');
  });
});

describe('viewer и счётчики', () => {
  it('viewer-флаги зависят от смотрящего и подписки', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.3.0.1');

    const guest = await request(app).get(`/api/users/${anna.user.username}`);
    expect(guest.body.viewer).toEqual({ isSelf: false, isFollowing: false, canFollow: false });

    const stranger = await request(app)
      .get(`/api/users/${anna.user.username}`)
      .set(authHeaders(boris));
    expect(stranger.body.viewer).toEqual({ isSelf: false, isFollowing: false, canFollow: true });

    const self = await request(app)
      .get(`/api/users/${anna.user.username}`)
      .set(authHeaders(anna));
    expect(self.body.viewer).toEqual({ isSelf: true, isFollowing: false, canFollow: false });
  });

  it('счётчики есть только в self-DTO, в публичном профиле их нет', async () => {
    const anna = await registerUser(app);
    const boris = await registerUser(app, {}, '10.3.0.2');
    await request(app)
      .post(`/api/users/${anna.user.username}/follow`)
      .set(authHeaders(boris, true));

    const annaMe = await me(app, anna);
    expect(annaMe.body.user.followersCount).toBe(1);
    expect(annaMe.body.user.followingCount).toBe(0);

    const patched = await request(app)
      .patch('/api/me/profile')
      .set(authHeaders(anna, true))
      .send({ displayName: 'Анна П.' });
    expect(patched.body.user.followersCount).toBe(1);

    const publicProfile = await request(app)
      .get(`/api/users/${anna.user.username}`)
      .set(authHeaders(boris));
    expect(publicProfile.body.user).not.toHaveProperty('followersCount');
    expect(publicProfile.body.user).not.toHaveProperty('followingCount');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../src/config.ts';
import { getDb } from '../src/db/index.ts';
import {
  authHeaders,
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

const UPLOADS_PREFIX = '/uploads/';

function relativeFromUrl(publicUrl: string | null): string | null {
  if (publicUrl === null) return null;
  expect(publicUrl.startsWith(UPLOADS_PREFIX)).toBe(true);
  return publicUrl.slice(UPLOADS_PREFIX.length);
}

function absoluteFromUrl(publicUrl: string | null): string | null {
  const relative = relativeFromUrl(publicUrl);
  return relative === null ? null : path.join(config.uploadDir, relative);
}

async function makePngBuffer(width = 600, height = 400): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 60, b: 60 } },
  })
    .png()
    .toBuffer();
}

function uploadAvatar(auth: AuthContext, buffer: Buffer) {
  return request(app)
    .post('/api/me/avatar')
    .set(authHeaders(auth, true))
    .attach('file', buffer, { filename: 'avatar.png', contentType: 'image/png' });
}

function uploadCover(auth: AuthContext, wishlistId: string, buffer: Buffer) {
  return request(app)
    .post(`/api/me/wishlists/${wishlistId}/cover`)
    .set(authHeaders(auth, true))
    .attach('file', buffer, { filename: 'cover.png', contentType: 'image/png' });
}

describe('аватар', () => {
  it('ресайзит в 256×256 webp, сохраняет путь и отдаёт URL в DTO', async () => {
    const auth = await registerUser(app);
    const response = await uploadAvatar(auth, await makePngBuffer(900, 700));

    expect(response.status).toBe(200);
    const avatarUrl = response.body.user.avatarPath as string;
    const relative = relativeFromUrl(avatarUrl);
    expect(relative).toMatch(/^avatars\/[0-9a-f-]{36}\.webp$/);

    const absolute = absoluteFromUrl(avatarUrl);
    expect(absolute).not.toBeNull();
    expect(fs.existsSync(absolute as string)).toBe(true);
    const metadata = await sharp(absolute as string).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);

    const dbRow = getDb().prepare('SELECT avatar_path FROM users WHERE id = ?').get(auth.user.id) as {
      avatar_path: string;
    };
    expect(dbRow.avatar_path).toBe(relative);

    const me = await request(app).get('/api/auth/me').set('Cookie', auth.cookie);
    expect(me.body.user.avatarPath).toBe(avatarUrl);

    const profile = await request(app).get(`/api/users/${auth.user.username}`);
    expect(profile.body.user.avatarPath).toBe(avatarUrl);
  });

  it('при замене удаляет старый файл', async () => {
    const auth = await registerUser(app);
    const first = await uploadAvatar(auth, await makePngBuffer());
    const firstAbsolute = absoluteFromUrl(first.body.user.avatarPath as string) as string;
    expect(fs.existsSync(firstAbsolute)).toBe(true);

    const second = await uploadAvatar(auth, await makePngBuffer(300, 500));
    expect(second.status).toBe(200);
    expect(second.body.user.avatarPath).not.toBe(first.body.user.avatarPath);
    expect(fs.existsSync(firstAbsolute)).toBe(false);

    const secondAbsolute = absoluteFromUrl(second.body.user.avatarPath as string) as string;
    expect(fs.existsSync(secondAbsolute)).toBe(true);
  });

  it('невалидное содержимое → 400 INVALID_IMAGE', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .post('/api/me/avatar')
      .set(authHeaders(auth, true))
      .attach('file', Buffer.from('это не картинка'), { filename: 'fake.png', contentType: 'image/png' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_IMAGE');
  });

  it('слишком большой файл → 413 PAYLOAD_TOO_LARGE', async () => {
    const auth = await registerUser(app);
    const tooLarge = Buffer.alloc(config.MAX_UPLOAD_MB * 1024 * 1024 + 1024);
    const response = await request(app)
      .post('/api/me/avatar')
      .set(authHeaders(auth, true))
      .attach('file', tooLarge, { filename: 'big.png', contentType: 'image/png' });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('без файла → 400 INVALID_IMAGE', async () => {
    const auth = await registerUser(app);
    const response = await request(app)
      .post('/api/me/avatar')
      .set(authHeaders(auth, true))
      .field('note', 'без файла');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_IMAGE');
  });

  it('требует вход и CSRF', async () => {
    const guest = await request(app)
      .post('/api/me/avatar')
      .attach('file', await makePngBuffer(), { filename: 'a.png', contentType: 'image/png' });
    expect(guest.status).toBe(401);

    const auth = await registerUser(app);
    const withoutCsrf = await request(app)
      .post('/api/me/avatar')
      .set('Cookie', auth.cookie)
      .attach('file', await makePngBuffer(), { filename: 'a.png', contentType: 'image/png' });
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.error.code).toBe('CSRF_FAILED');
  });
});

describe('обложка вишлиста', () => {
  it('ресайзит в 1600×600 webp, отдаёт coverPath и удаляет файл по DELETE', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { title: 'С обложкой' });

    const uploaded = await uploadCover(auth, wishlist.id, await makePngBuffer(1200, 1200));
    expect(uploaded.status).toBe(200);
    const coverUrl = uploaded.body.wishlist.coverPath as string;
    const coverRelative = relativeFromUrl(coverUrl);
    expect(coverRelative).toMatch(/^covers\/[0-9a-f-]{36}\.webp$/);
    const coverAbsolute = absoluteFromUrl(coverUrl) as string;
    expect(fs.existsSync(coverAbsolute)).toBe(true);
    const metadata = await sharp(coverAbsolute).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(600);

    const dbRow = getDb().prepare('SELECT cover_path FROM wishlists WHERE id = ?').get(wishlist.id) as {
      cover_path: string;
    };
    expect(dbRow.cover_path).toBe(coverRelative);

    const list = await request(app).get('/api/me/wishlists').set(authHeaders(auth));
    expect(list.body.wishlists[0].coverPath).toBe(coverUrl);

    const publicView = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(publicView.body.wishlist.coverPath).toBe(coverUrl);

    const deleted = await request(app)
      .delete(`/api/me/wishlists/${wishlist.id}/cover`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(200);
    expect(deleted.body.wishlist.coverPath).toBeNull();
    expect(fs.existsSync(coverAbsolute)).toBe(false);
  });

  it('при замене обложки удаляет старый файл', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth);

    const first = await uploadCover(auth, wishlist.id, await makePngBuffer());
    const firstAbsolute = absoluteFromUrl(first.body.wishlist.coverPath as string) as string;
    const second = await uploadCover(auth, wishlist.id, await makePngBuffer(900, 900));
    expect(second.status).toBe(200);
    expect(second.body.wishlist.coverPath).not.toBe(first.body.wishlist.coverPath);
    expect(fs.existsSync(firstAbsolute)).toBe(false);
  });

  it('невалидная картинка и чужая обложка', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app, {}, '10.8.0.1');
    const wishlist = await createWishlist(app, owner);

    const invalid = await uploadCover(owner, wishlist.id, Buffer.from('nope'));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_IMAGE');

    const foreign = await uploadCover(stranger, wishlist.id, await makePngBuffer());
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');

    const guest = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/cover`)
      .attach('file', await makePngBuffer(), { filename: 'c.png', contentType: 'image/png' });
    expect(guest.status).toBe(401);
  });

  it('DELETE без обложки возвращает wishlist с coverPath=null', async () => {
    const auth = await registerUser(app);
    const wishlist: WishlistBody = await createWishlist(app, auth);
    const response = await request(app)
      .delete(`/api/me/wishlists/${wishlist.id}/cover`)
      .set(authHeaders(auth, true));
    expect(response.status).toBe(200);
    expect(response.body.wishlist.coverPath).toBeNull();
  });
});

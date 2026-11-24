import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
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

const THEME = '#C4574D';
const THEME_2 = '#5A7BA6';

describe('цвет-тема вишлиста', () => {
  it('создаёт вишлист с темой; по умолчанию null', async () => {
    const auth = await registerUser(app);

    const themed = await createWishlist(app, auth, { title: 'С темой', themeColor: THEME });
    expect(themed.themeColor).toBe(THEME);

    const plain = await createWishlist(app, auth, { title: 'Без темы' });
    expect(plain.themeColor).toBeNull();

    const explicitNull = await createWishlist(app, auth, { title: 'Null', themeColor: null });
    expect(explicitNull.themeColor).toBeNull();
  });

  it('меняет и сбрасывает тему через PATCH', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, { themeColor: THEME });

    const changed = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeColor: THEME_2 });
    expect(changed.status).toBe(200);
    expect(changed.body.wishlist.themeColor).toBe(THEME_2);

    const reset = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeColor: null });
    expect(reset.status).toBe(200);
    expect(reset.body.wishlist.themeColor).toBeNull();

    // PATCH без themeColor не меняет тему.
    const again = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeColor: THEME_2 });
    expect(again.status).toBe(200);
    const renamed = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Новое название' });
    expect(renamed.body.wishlist.themeColor).toBe(THEME_2);
  });

  it('невалидный цвет → 400 INVALID_COLOR (create и patch)', async () => {
    const auth = await registerUser(app);
    const invalidValues: unknown[] = ['red', '#12345', '#1234567', 42, { hex: THEME }];

    for (const themeColor of invalidValues) {
      const created = await request(app)
        .post('/api/me/wishlists')
        .set(authHeaders(auth, true))
        .send({ title: 'Плохой цвет', themeColor });
      expect(created.status).toBe(400);
      expect(created.body.error.code).toBe('INVALID_COLOR');
    }

    const wishlist = await createWishlist(app, auth);
    const patched = await request(app)
      .patch(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth, true))
      .send({ themeColor: '#123abc' });
    // Любой цвет #RRGGBB допустим; сервер приводит к верхнему регистру.
    expect(patched.status).toBe(200);
    expect(patched.body.wishlist.themeColor).toBe('#123ABC');
  });

  it('цвет-тема виден владельцу и в публичном виде', async () => {
    const auth = await registerUser(app);
    const wishlist = await createWishlist(app, auth, {
      title: 'Тематический',
      visibility: 'public',
      themeColor: THEME,
    });

    const list = await request(app).get('/api/me/wishlists').set(authHeaders(auth));
    expect(list.body.wishlists[0].themeColor).toBe(THEME);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlist.id}`)
      .set(authHeaders(auth));
    expect(detail.body.wishlist.themeColor).toBe(THEME);

    const publicView = await request(app).get(`/api/w/${wishlist.shareToken}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.wishlist.themeColor).toBe(THEME);
  });
});

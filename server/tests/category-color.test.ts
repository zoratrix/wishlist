import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createCategory,
  createGift,
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

const BLUE = '#7FAFE2';
const GREEN = '#7FC290';

async function setup(): Promise<{ auth: AuthContext; wishlistId: string; shareToken: string }> {
  const auth = await registerUser(app);
  const wishlist = await createWishlist(app, auth, { title: 'Цвета', visibility: 'link' });
  return { auth, wishlistId: wishlist.id, shareToken: wishlist.shareToken };
}

describe('цвет категории', () => {
  it('создаёт категорию с цветом из палитры и без цвета (null)', async () => {
    const { auth, wishlistId } = await setup();

    const colored = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Книги', color: BLUE });
    expect(colored.status).toBe(201);
    expect(colored.body.category).toMatchObject({ name: 'Книги', color: BLUE });

    const plain = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Уют' });
    expect(plain.status).toBe(201);
    expect(plain.body.category.color).toBeNull();

    const explicitNull = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Пусто', color: null });
    expect(explicitNull.status).toBe(201);
    expect(explicitNull.body.category.color).toBeNull();
  });

  it('невалидный цвет → 400 INVALID_COLOR', async () => {
    const { auth, wishlistId } = await setup();

    const invalidColors: unknown[] = ['#000000', 'red', '#dc2626', '', 123, { hex: BLUE }];
    for (const color of invalidColors) {
      const response = await request(app)
        .post(`/api/me/wishlists/${wishlistId}/categories`)
        .set(authHeaders(auth, true))
        .send({ name: `Категория ${String(color)}`, color });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_COLOR');
    }
  });

  it('PATCH: меняет только цвет, только имя или оба поля', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги', BLUE);

    const onlyColor = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ color: GREEN });
    expect(onlyColor.status).toBe(200);
    expect(onlyColor.body.category).toEqual({ id: category.id, name: 'Книги', color: GREEN });

    const onlyName = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ name: 'Литература' });
    expect(onlyName.status).toBe(200);
    expect(onlyName.body.category).toEqual({
      id: category.id,
      name: 'Литература',
      color: GREEN,
    });

    const both = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ name: 'Классика', color: BLUE });
    expect(both.status).toBe(200);
    expect(both.body.category).toEqual({ id: category.id, name: 'Классика', color: BLUE });

    const invalid = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ color: '#123456' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_COLOR');
  });

  it('PATCH с color: null сбрасывает цвет, пустой PATCH → 400', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги', BLUE);

    const reset = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ color: null });
    expect(reset.status).toBe(200);
    expect(reset.body.category.color).toBeNull();

    const empty = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('цвет не влияет на уникальность названий', async () => {
    const { auth, wishlistId } = await setup();
    await createCategory(app, auth, wishlistId, 'Книги', BLUE);

    const sameNameOtherColor = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Книги', color: GREEN });
    expect(sameNameOtherColor.status).toBe(409);
    expect(sameNameOtherColor.body.error.code).toBe('CATEGORY_EXISTS');

    const otherNameSameColor = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Классика', color: BLUE });
    expect(otherNameSameColor.status).toBe(201);
    expect(otherNameSameColor.body.category.color).toBe(BLUE);
  });

  it('цвет виден владельцу и гостю, в том числе в тегах подарка', async () => {
    const { auth, wishlistId, shareToken } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги', BLUE);
    await createGift(app, auth, wishlistId, {
      title: 'Подарок',
      categoryIds: [category.id],
    });

    const owner = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(owner.body.categories).toEqual([{ id: category.id, name: 'Книги', color: BLUE }]);
    expect(owner.body.gifts[0].categories).toEqual([
      { id: category.id, name: 'Книги', color: BLUE },
    ]);

    const guest = await request(app).get(`/api/w/${shareToken}`);
    expect(guest.status).toBe(200);
    expect(guest.body.categories).toEqual([{ id: category.id, name: 'Книги', color: BLUE }]);
    expect(guest.body.gifts[0].categories).toEqual([
      { id: category.id, name: 'Книги', color: BLUE },
    ]);
  });

  it('цвет сохраняется после переименования категории', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги', GREEN);

    const renamed = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ name: 'Литература' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.category.color).toBe(GREEN);
  });
});

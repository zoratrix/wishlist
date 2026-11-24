import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import {
  authHeaders,
  createCategory,
  createGift,
  createTestApp,
  createWishlist,
  registerUser,
  resetAll,
  type AuthContext,
  type CategoryBody,
} from './helpers.ts';

let app: Express;

beforeEach(() => {
  resetAll();
  app = createTestApp();
});

function categoryCount(wishlistId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM categories WHERE wishlist_id = ?')
    .get(wishlistId) as { count: number };
  return row.count;
}

function giftCategoryCount(giftId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM gift_categories WHERE gift_id = ?')
    .get(giftId) as { count: number };
  return row.count;
}

async function setup(): Promise<{ auth: AuthContext; wishlistId: string; shareToken: string }> {
  const auth = await registerUser(app);
  const wishlist = await createWishlist(app, auth, { title: 'С категориями', visibility: 'link' });
  return { auth, wishlistId: wishlist.id, shareToken: wishlist.shareToken };
}

describe('категории вишлиста (CRUD)', () => {
  it('создаёт категорию, обрезает пробелы и отдаёт список по алфавиту', async () => {
    const { auth, wishlistId } = await setup();

    const created = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: '  Электроника  ' });
    expect(created.status).toBe(201);
    expect(created.body.category).toMatchObject({ name: 'Электроника' });
    expect(typeof created.body.category.id).toBe('string');
    expect(created.body.category).not.toHaveProperty('wishlistId');

    const second = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Книги' });
    expect(second.status).toBe(201);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(detail.status).toBe(200);
    expect(detail.body.categories.map((item: CategoryBody) => item.name)).toEqual([
      'Книги',
      'Электроника',
    ]);
  });

  it('переименовывает категорию', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги');

    const renamed = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true))
      .send({ name: '  Литература  ' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.category).toEqual({ id: category.id, name: 'Литература', color: null });

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(detail.body.categories).toEqual([
      { id: category.id, name: 'Литература', color: null },
    ]);
  });

  it('удаляет категорию', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги');

    const deleted = await request(app)
      .delete(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(204);
    expect(categoryCount(wishlistId)).toBe(0);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(detail.body.categories).toEqual([]);
  });

  it('валидирует название: пустое и длиннее 40 символов → 400', async () => {
    const { auth, wishlistId } = await setup();

    for (const name of ['   ', 'а'.repeat(41)]) {
      const response = await request(app)
        .post(`/api/me/wishlists/${wishlistId}/categories`)
        .set(authHeaders(auth, true))
        .send({ name });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('не допускает дубликат названия внутри вишлиста (409)', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги');

    const duplicate = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Книги' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CATEGORY_EXISTS');

    const other = await createCategory(app, auth, wishlistId, 'Электроника');
    const renameToExisting = await request(app)
      .patch(`/api/me/categories/${other.id}`)
      .set(authHeaders(auth, true))
      .send({ name: category.name });
    expect(renameToExisting.status).toBe(409);
    expect(renameToExisting.body.error.code).toBe('CATEGORY_EXISTS');
  });

  it('разрешает одинаковые названия в разных вишлистах', async () => {
    const { auth, wishlistId } = await setup();
    const other = await createWishlist(app, auth, { title: 'Другой список' });

    await createCategory(app, auth, wishlistId, 'Книги');
    const second = await createCategory(app, auth, other.id, 'Книги');
    expect(second.name).toBe('Книги');
  });

  it('ограничивает 20 категорий на список (422 TOO_MANY_CATEGORIES)', async () => {
    const { auth, wishlistId } = await setup();
    for (let index = 0; index < 20; index += 1) {
      await createCategory(app, auth, wishlistId, `Категория ${index}`);
    }

    const extra = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/categories`)
      .set(authHeaders(auth, true))
      .send({ name: 'Двадцать первая' });
    expect(extra.status).toBe(422);
    expect(extra.body.error.code).toBe('TOO_MANY_CATEGORIES');
    expect(categoryCount(wishlistId)).toBe(20);
  });

  it('доступ только у владельца: чужие списки и категории → 404', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app, {}, '10.0.0.77');
    const wishlist = await createWishlist(app, owner);
    const category = await createCategory(app, owner, wishlist.id, 'Секретная');

    const createForeign = await request(app)
      .post(`/api/me/wishlists/${wishlist.id}/categories`)
      .set(authHeaders(stranger, true))
      .send({ name: 'Чужая' });
    expect(createForeign.status).toBe(404);
    expect(createForeign.body.error.code).toBe('NOT_FOUND');

    const renameForeign = await request(app)
      .patch(`/api/me/categories/${category.id}`)
      .set(authHeaders(stranger, true))
      .send({ name: 'Взлом' });
    expect(renameForeign.status).toBe(404);

    const deleteForeign = await request(app)
      .delete(`/api/me/categories/${category.id}`)
      .set(authHeaders(stranger, true));
    expect(deleteForeign.status).toBe(404);

    const missing = await request(app)
      .patch('/api/me/categories/no-such-category')
      .set(authHeaders(owner, true))
      .send({ name: 'Ничего' });
    expect(missing.status).toBe(404);
  });
});

describe('теги подарков', () => {
  it('создаёт подарок с категориями и сортирует их по алфавиту', async () => {
    const { auth, wishlistId } = await setup();
    const electronics = await createCategory(app, auth, wishlistId, 'Электроника');
    const accessories = await createCategory(app, auth, wishlistId, 'Аксессуары');

    const created = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Наушники', categoryIds: [electronics.id, accessories.id] });

    expect(created.status).toBe(201);
    expect(created.body.gift.categories).toEqual([
      { id: accessories.id, name: 'Аксессуары', color: null },
      { id: electronics.id, name: 'Электроника', color: null },
    ]);
    expect(giftCategoryCount(created.body.gift.id)).toBe(2);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(detail.body.gifts[0].categories).toEqual([
      { id: accessories.id, name: 'Аксессуары', color: null },
      { id: electronics.id, name: 'Электроника', color: null },
    ]);
  });

  it('PATCH с [] очищает теги, PATCH без categoryIds их не меняет', async () => {
    const { auth, wishlistId } = await setup();
    const first = await createCategory(app, auth, wishlistId, 'Книги');
    const second = await createCategory(app, auth, wishlistId, 'Классика');
    const gift = await createGift(app, auth, wishlistId, {
      title: 'Книга',
      categoryIds: [first.id, second.id],
    });

    const renamed = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ title: 'Новая книга' });
    expect(renamed.status).toBe(200);
    // Ответ сортирует теги по алфавиту, а не по порядку назначения.
    expect(renamed.body.gift.categories).toEqual([
      { id: second.id, name: 'Классика', color: null },
      { id: first.id, name: 'Книги', color: null },
    ]);

    const cleared = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ categoryIds: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.gift.categories).toEqual([]);
    expect(giftCategoryCount(gift.id)).toBe(0);
  });

  it('отклоняет чужие категории, дубликаты, несуществующие id и больше 5', async () => {
    const { auth, wishlistId } = await setup();
    const otherWishlist = await createWishlist(app, auth, { title: 'Другой список' });
    const foreignCategory = await createCategory(app, auth, otherWishlist.id, 'Чужая категория');
    const ownCategory = await createCategory(app, auth, wishlistId, 'Своя');
    const gift = await createGift(app, auth, wishlistId);

    const crossWishlist = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ categoryIds: [foreignCategory.id] });
    expect(crossWishlist.status).toBe(400);
    expect(crossWishlist.body.error.code).toBe('VALIDATION_ERROR');

    const crossWishlistCreate = await request(app)
      .post(`/api/me/wishlists/${wishlistId}/gifts`)
      .set(authHeaders(auth, true))
      .send({ title: 'Подарок', categoryIds: [foreignCategory.id] });
    expect(crossWishlistCreate.status).toBe(400);

    const duplicates = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ categoryIds: [ownCategory.id, ownCategory.id] });
    expect(duplicates.status).toBe(400);

    const missing = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ categoryIds: ['no-such-category'] });
    expect(missing.status).toBe(400);

    const many = Array.from({ length: 6 }, (_, index) => `category-${index}`);
    const tooMany = await request(app)
      .patch(`/api/me/gifts/${gift.id}`)
      .set(authHeaders(auth, true))
      .send({ categoryIds: many });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('перенос подарка в другой вишлист сбрасывает теги', async () => {
    const { auth, wishlistId } = await setup();
    const target = await createWishlist(app, auth, { title: 'Целевой список' });
    const category = await createCategory(app, auth, wishlistId, 'Книги');
    const gift = await createGift(app, auth, wishlistId, { categoryIds: [category.id] });
    expect(giftCategoryCount(gift.id)).toBe(1);

    const moved = await request(app)
      .post(`/api/me/gifts/${gift.id}/move`)
      .set(authHeaders(auth, true))
      .send({ wishlistId: target.id });
    expect(moved.status).toBe(200);
    expect(moved.body.gift.categories).toEqual([]);
    expect(giftCategoryCount(gift.id)).toBe(0);

    const targetDetail = await request(app)
      .get(`/api/me/wishlists/${target.id}`)
      .set(authHeaders(auth));
    expect(targetDetail.body.gifts[0].categories).toEqual([]);
  });

  it('удаление категории снимает тег с подарка, подарок остаётся', async () => {
    const { auth, wishlistId } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги');
    const gift = await createGift(app, auth, wishlistId, { categoryIds: [category.id] });

    const deleted = await request(app)
      .delete(`/api/me/categories/${category.id}`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(204);
    expect(giftCategoryCount(gift.id)).toBe(0);

    const detail = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(detail.body.gifts).toHaveLength(1);
    expect(detail.body.gifts[0].categories).toEqual([]);
  });

  it('публичный вид возвращает категории списка и теги подарков', async () => {
    const { auth, wishlistId, shareToken } = await setup();
    const electronics = await createCategory(app, auth, wishlistId, 'Электроника');
    const cozy = await createCategory(app, auth, wishlistId, 'Уют');
    await createGift(app, auth, wishlistId, {
      title: 'Наушники',
      links: ['https://example.com/sony'],
      categoryIds: [cozy.id, electronics.id],
    });

    const response = await request(app).get(`/api/w/${shareToken}`);
    expect(response.status).toBe(200);
    expect(response.body.categories.map((item: CategoryBody) => item.name)).toEqual([
      'Уют',
      'Электроника',
    ]);
    expect(response.body.gifts[0].categories.map((item: CategoryBody) => item.name)).toEqual([
      'Уют',
      'Электроника',
    ]);
    expect(response.body.gifts[0].links).toEqual(['https://example.com/sony']);
  });

  it('удаление вишлиста каскадно удаляет категории и связи, чужие не страдают', async () => {
    const { auth, wishlistId } = await setup();
    const other = await createWishlist(app, auth, { title: 'Второй список' });
    const category = await createCategory(app, auth, wishlistId, 'Книги');
    const otherCategory = await createCategory(app, auth, other.id, 'Другая');
    const gift = await createGift(app, auth, wishlistId, { categoryIds: [category.id] });

    const deleted = await request(app)
      .delete(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth, true));
    expect(deleted.status).toBe(204);

    expect(categoryCount(wishlistId)).toBe(0);
    expect(giftCategoryCount(gift.id)).toBe(0);

    const otherDetail = await request(app)
      .get(`/api/me/wishlists/${other.id}`)
      .set(authHeaders(auth));
    expect(otherDetail.body.categories).toEqual([
      { id: otherCategory.id, name: 'Другая', color: null },
    ]);
  });

  it('подарок с тегами виден в публичном виде и в списке владельца одинаково', async () => {
    const { auth, wishlistId, shareToken } = await setup();
    const category = await createCategory(app, auth, wishlistId, 'Книги');
    const gift = await createGift(app, auth, wishlistId, { categoryIds: [category.id] });

    const owner = await request(app)
      .get(`/api/me/wishlists/${wishlistId}`)
      .set(authHeaders(auth));
    expect(owner.body.gifts[0].categories).toEqual([
      { id: category.id, name: 'Книги', color: null },
    ]);

    const guest = await request(app).get(`/api/w/${shareToken}`);
    expect(guest.body.gifts[0].id).toBe(gift.id);
    expect(guest.body.gifts[0].categories).toEqual([
      { id: category.id, name: 'Книги', color: null },
    ]);
  });
});

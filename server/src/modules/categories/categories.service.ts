import { getDb } from '../../db/index.ts';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../errors.ts';
import { newId } from '../../lib/crypto.ts';
import { isUniqueConstraintError } from '../../lib/db-errors.ts';
import { sortCategoryDTOs, toCategoryDTOs } from '../../lib/dto.ts';
import type { CategoryDTO } from '../../lib/dto.ts';
import type { CategoryRow, WishlistRow } from '../../lib/rows.ts';
import { isCategoryColor } from '../../lib/schemas.ts';

export const MAX_CATEGORIES_PER_WISHLIST = 20;
export const MAX_CATEGORIES_PER_GIFT = 5;

const CATEGORY_EXISTS_MESSAGE = 'Категория с таким названием уже есть в этом списке.';
const INVALID_COLOR_MESSAGE = 'Неверный цвет категории. Выберите цвет из палитры.';
const LINKS_BATCH_SIZE = 500;

/**
 * Приводит входной `color` к виду для БД:
 * undefined — поле не передано (при PATCH цвет не меняем);
 * null — «цвет по умолчанию»;
 * строка из палитры — допустимый цвет; всё остальное → 400 INVALID_COLOR.
 */
export function normalizeCategoryColor(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (isCategoryColor(value)) return value;
  throw new AppError(400, 'INVALID_COLOR', INVALID_COLOR_MESSAGE);
}

export function findCategoryRow(categoryId: string): CategoryRow | null {
  const row = getDb().prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  return row ? (row as CategoryRow) : null;
}

/** Категории вишлиста по алфавиту (публичные данные списка). */
export function listWishlistCategories(wishlistId: string): CategoryDTO[] {
  const rows = getDb()
    .prepare('SELECT * FROM categories WHERE wishlist_id = ?')
    .all(wishlistId) as CategoryRow[];
  return toCategoryDTOs(rows);
}

/** Категория только владельцу её вишлиста; чужая/несуществующая — 404. */
export function getOwnedCategory(categoryId: string, ownerId: string): CategoryRow {
  const row = getDb()
    .prepare(
      `SELECT c.* FROM categories c
         JOIN wishlists w ON w.id = c.wishlist_id
        WHERE c.id = ? AND w.owner_id = ?`,
    )
    .get(categoryId, ownerId);
  if (!row) throw new NotFoundError();
  return row as CategoryRow;
}

function categoryCount(wishlistId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM categories WHERE wishlist_id = ?')
    .get(wishlistId) as { count: number };
  return row.count;
}

export function createCategory(
  wishlist: WishlistRow,
  name: string,
  color: string | null,
): CategoryRow {
  if (categoryCount(wishlist.id) >= MAX_CATEGORIES_PER_WISHLIST) {
    throw new AppError(
      422,
      'TOO_MANY_CATEGORIES',
      `В одном списке может быть не больше ${MAX_CATEGORIES_PER_WISHLIST} категорий.`,
    );
  }
  const id = newId();
  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        'INSERT INTO categories (id, wishlist_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, wishlist.id, name, color, now);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ConflictError('CATEGORY_EXISTS', CATEGORY_EXISTS_MESSAGE);
    throw error;
  }
  const row = findCategoryRow(id);
  if (row === null) throw new Error('Не удалось создать категорию');
  return row;
}

export interface CategoryUpdatePatch {
  name?: string;
  color?: string | null;
}

/**
 * PATCH категории: можно менять только имя, только цвет или оба поля.
 * Отсутствие поля — значение не меняется; color: null — сброс на «по умолчанию».
 */
export function updateCategory(category: CategoryRow, patch: CategoryUpdatePatch): CategoryRow {
  const name = patch.name ?? category.name;
  const color = patch.color === undefined ? category.color : patch.color;
  const nameChanged = name !== category.name;

  if (nameChanged) {
    const duplicate = getDb()
      .prepare('SELECT 1 AS found FROM categories WHERE wishlist_id = ? AND name = ? AND id <> ?')
      .get(category.wishlist_id, name, category.id);
    if (duplicate !== undefined) {
      throw new ConflictError('CATEGORY_EXISTS', CATEGORY_EXISTS_MESSAGE);
    }
  }

  try {
    getDb()
      .prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
      .run(name, color, category.id);
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ConflictError('CATEGORY_EXISTS', CATEGORY_EXISTS_MESSAGE);
    throw error;
  }
  const row = findCategoryRow(category.id);
  if (row === null) throw new NotFoundError();
  return row;
}

/** Удаление категории снимает её с подарков (gift_categories → ON DELETE CASCADE). */
export function deleteCategory(category: CategoryRow): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(category.id);
}

/**
 * Теги пачки подарков — один запрос на пачку (без N+1).
 * Возвращает map gift_id → CategoryDTO[] (по алфавиту).
 */
export function loadGiftCategories(giftIds: readonly string[]): Map<string, CategoryDTO[]> {
  const result = new Map<string, CategoryDTO[]>();
  for (let start = 0; start < giftIds.length; start += LINKS_BATCH_SIZE) {
    const chunk = giftIds.slice(start, start + LINKS_BATCH_SIZE);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = getDb()
      .prepare(
        `SELECT gc.gift_id, c.id, c.name, c.color
           FROM gift_categories gc
           JOIN categories c ON c.id = gc.category_id
          WHERE gc.gift_id IN (${placeholders})`,
      )
      .all(...chunk) as Array<{ gift_id: string; id: string; name: string; color: string | null }>;
    for (const row of rows) {
      const list = result.get(row.gift_id);
      const dto: CategoryDTO = { id: row.id, name: row.name, color: row.color };
      if (list === undefined) result.set(row.gift_id, [dto]);
      else list.push(dto);
    }
  }
  for (const [giftId, list] of result) result.set(giftId, sortCategoryDTOs(list));
  return result;
}

/**
 * Проверяет, что все категории принадлежат вишлисту подарка (иначе 400),
 * и что их не больше 5. Дублирует ограничение из Zod на случай прямых вызовов.
 */
export function validateCategoryIds(wishlistId: string, categoryIds: readonly string[]): void {
  if (categoryIds.length === 0) return;
  if (categoryIds.length > MAX_CATEGORIES_PER_GIFT) {
    throw new ValidationError([
      { path: 'categoryIds', message: `У подарка может быть не больше ${MAX_CATEGORIES_PER_GIFT} категорий.` },
    ]);
  }
  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new ValidationError([{ path: 'categoryIds', message: 'Категории не должны повторяться.' }]);
  }
  const placeholders = categoryIds.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`SELECT id FROM categories WHERE wishlist_id = ? AND id IN (${placeholders})`)
    .all(wishlistId, ...categoryIds) as Array<{ id: string }>;
  if (rows.length !== categoryIds.length) {
    throw new ValidationError([
      { path: 'categoryIds', message: 'Все категории должны принадлежать вишлисту подарка.' },
    ]);
  }
}

export function deleteGiftCategories(giftId: string): void {
  getDb().prepare('DELETE FROM gift_categories WHERE gift_id = ?').run(giftId);
}

export function replaceGiftCategories(giftId: string, categoryIds: readonly string[]): void {
  const db = getDb();
  deleteGiftCategories(giftId);
  const insert = db.prepare('INSERT INTO gift_categories (gift_id, category_id) VALUES (?, ?)');
  for (const categoryId of categoryIds) insert.run(giftId, categoryId);
}

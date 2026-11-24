import { getDb } from '../../db/index.ts';
import { NotFoundError } from '../../errors.ts';
import { newId } from '../../lib/crypto.ts';
import { guestBookingView, ownerBookingView, toGiftDTO } from '../../lib/dto.ts';
import type { BookingView, GiftDTO } from '../../lib/dto.ts';
import type { GiftStatus, GiftWithBookingRow, WishlistRow } from '../../lib/rows.ts';
import {
  deleteGiftCategories,
  loadGiftCategories,
  replaceGiftCategories,
  validateCategoryIds,
} from '../categories/categories.service.ts';
import type { CreateGiftInput, UpdateGiftInput } from './gifts.schemas.ts';

/**
 * Подарок с активной бронью. LEFT JOIN по условию `cancelled_at IS NULL`:
 * отменённые брони в выборку не попадают, а частичный UNIQUE-индекс гарантирует,
 * что активная бронь максимум одна.
 */
const GIFT_SELECT = `
  SELECT g.*, b.customer_name AS booking_name, b.created_at AS booking_created_at
    FROM gifts g
    LEFT JOIN bookings b ON b.gift_id = g.id AND b.cancelled_at IS NULL`;

/** SQLite ограничивает число параметров; пачки по 500 — безопасно. */
const LINKS_BATCH_SIZE = 500;

export function listGiftRows(wishlistId: string): GiftWithBookingRow[] {
  return getDb()
    .prepare(`${GIFT_SELECT} WHERE g.wishlist_id = ? ORDER BY g.sort_order, g.created_at`)
    .all(wishlistId) as GiftWithBookingRow[];
}

export function findGiftRow(giftId: string): GiftWithBookingRow | null {
  const row = getDb().prepare(`${GIFT_SELECT} WHERE g.id = ?`).get(giftId);
  return row ? (row as GiftWithBookingRow) : null;
}

export function findGiftInWishlist(giftId: string, wishlistId: string): GiftWithBookingRow | null {
  const row = getDb()
    .prepare(`${GIFT_SELECT} WHERE g.id = ? AND g.wishlist_id = ?`)
    .get(giftId, wishlistId);
  return row ? (row as GiftWithBookingRow) : null;
}

export interface OwnedGift {
  gift: GiftWithBookingRow;
  wishlist: WishlistRow;
}

/** Подарок только владельцу вишлиста; чужой/несуществующий — 404. */
export function getOwnedGift(giftId: string, ownerId: string): OwnedGift {
  const gift = findGiftRow(giftId);
  if (gift === null) throw new NotFoundError();
  const wishlistRow = getDb()
    .prepare('SELECT * FROM wishlists WHERE id = ? AND owner_id = ?')
    .get(gift.wishlist_id, ownerId);
  if (!wishlistRow) throw new NotFoundError();
  return { gift, wishlist: wishlistRow as WishlistRow };
}

function nextGiftSortOrder(wishlistId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM gifts WHERE wishlist_id = ?')
    .get(wishlistId) as { max_order: number };
  return row.max_order + 1;
}

/** Дубликаты удаляются, порядок первого вхождения сохраняется. */
function dedupeLinks(links: readonly string[]): string[] {
  return [...new Set(links)];
}

function insertGiftLinks(giftId: string, links: readonly string[], now: string): void {
  const insert = getDb().prepare(
    'INSERT INTO gift_links (id, gift_id, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  links.forEach((url, index) => insert.run(newId(), giftId, url, index, now));
}

function replaceGiftLinks(giftId: string, links: readonly string[], now: string): void {
  getDb().prepare('DELETE FROM gift_links WHERE gift_id = ?').run(giftId);
  insertGiftLinks(giftId, links, now);
}

/** Ссылки одного подарка в порядке пользователя (для одиночных ответов). */
export function getGiftLinks(giftId: string): string[] {
  const rows = getDb()
    .prepare('SELECT url FROM gift_links WHERE gift_id = ? ORDER BY sort_order, rowid')
    .all(giftId) as Array<{ url: string }>;
  return rows.map((row) => row.url);
}

/**
 * Ссылки для пачки подарков — ОДИН запрос, чтобы в списках не было N+1.
 * Возвращает map gift_id → [url, …] в порядке sort_order.
 */
export function loadGiftLinks(giftIds: readonly string[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (let start = 0; start < giftIds.length; start += LINKS_BATCH_SIZE) {
    const chunk = giftIds.slice(start, start + LINKS_BATCH_SIZE);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = getDb()
      .prepare(
        `SELECT gift_id, url FROM gift_links
          WHERE gift_id IN (${placeholders})
          ORDER BY gift_id, sort_order, rowid`,
      )
      .all(...chunk) as Array<{ gift_id: string; url: string }>;
    for (const row of rows) {
      const list = result.get(row.gift_id);
      if (list === undefined) result.set(row.gift_id, [row.url]);
      else list.push(row.url);
    }
  }
  return result;
}

/** Подарок, ссылки и теги создаются в одной транзакции. */
export function createGift(wishlist: WishlistRow, input: CreateGiftInput): GiftWithBookingRow {
  const db = getDb();
  const id = newId();
  const now = new Date().toISOString();
  const links = dedupeLinks(input.links ?? []);
  const categoryIds = input.categoryIds ?? [];
  validateCategoryIds(wishlist.id, categoryIds);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO gifts
         (id, wishlist_id, title, description, price_minor, currency, priority, status, sort_order,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)`,
    ).run(
      id,
      wishlist.id,
      input.title,
      input.description ?? null,
      input.priceMinor ?? null,
      input.currency ?? 'RUB',
      input.priority ?? 3,
      nextGiftSortOrder(wishlist.id),
      now,
      now,
    );
    insertGiftLinks(id, links, now);
    replaceGiftCategories(id, categoryIds);
  })();

  const gift = findGiftRow(id);
  if (gift === null) throw new Error('Не удалось создать подарок');
  return gift;
}

export function updateGift(gift: GiftWithBookingRow, input: UpdateGiftInput): GiftWithBookingRow {
  const title = input.title ?? gift.title;
  const description = input.description === undefined ? gift.description : input.description;
  const priceMinor = input.priceMinor === undefined ? gift.price_minor : input.priceMinor;
  const currency = input.currency ?? gift.currency;
  const priority = input.priority ?? gift.priority;
  // undefined — поле не передано, список не трогаем; [] — очищаем.
  const links = input.links === undefined ? null : dedupeLinks(input.links);
  const categoryIds = input.categoryIds === undefined ? null : input.categoryIds;
  if (categoryIds !== null) validateCategoryIds(gift.wishlist_id, categoryIds);
  const now = new Date().toISOString();

  const db = getDb();
  db.transaction(() => {
    db.prepare(
      `UPDATE gifts
          SET title = ?, description = ?, price_minor = ?, currency = ?, priority = ?, updated_at = ?
        WHERE id = ?`,
    ).run(title, description, priceMinor, currency, priority, now, gift.id);
    if (links !== null) replaceGiftLinks(gift.id, links, now);
    if (categoryIds !== null) replaceGiftCategories(gift.id, categoryIds);
  })();

  const updated = findGiftRow(gift.id);
  if (updated === null) throw new NotFoundError();
  return updated;
}

export function deleteGift(gift: GiftWithBookingRow): void {
  // Ссылки, теги и брони удаляются каскадно.
  getDb().prepare('DELETE FROM gifts WHERE id = ?').run(gift.id);
}

export function reorderGifts(wishlist: WishlistRow, order: string[]): void {
  const db = getDb();
  const rows = db
    .prepare('SELECT id FROM gifts WHERE wishlist_id = ?')
    .all(wishlist.id) as Array<{ id: string }>;
  const ids = new Set(rows.map((row) => row.id));
  for (const giftId of order) {
    if (!ids.has(giftId)) throw new NotFoundError();
  }
  const update = db.prepare('UPDATE gifts SET sort_order = ? WHERE id = ? AND wishlist_id = ?');
  db.transaction(() => {
    order.forEach((giftId, index) => update.run(index, giftId, wishlist.id));
  })();
}

/**
 * «Уже подарен» закрывает активную бронь с причиной owner_gifted; обратное
 * переключение бронь не восстанавливает. Всё — одной транзакцией.
 */
export function setGiftStatus(gift: GiftWithBookingRow, status: GiftStatus): GiftWithBookingRow {
  const db = getDb();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE gifts SET status = ?, updated_at = ? WHERE id = ?').run(status, now, gift.id);
    if (status === 'gifted') {
      db.prepare(
        `UPDATE bookings SET cancelled_at = ?, cancelled_reason = 'owner_gifted'
          WHERE gift_id = ? AND cancelled_at IS NULL`,
      ).run(now, gift.id);
    }
  })();
  const updated = findGiftRow(gift.id);
  if (updated === null) throw new NotFoundError();
  return updated;
}

/** Перенос подарка в другой вишлист сбрасывает теги: категории принадлежат списку. */
export function moveGift(gift: GiftWithBookingRow, target: WishlistRow): GiftWithBookingRow {
  const db = getDb();
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE gifts SET wishlist_id = ?, sort_order = ?, updated_at = ? WHERE id = ?').run(
      target.id,
      nextGiftSortOrder(target.id),
      now,
      gift.id,
    );
    deleteGiftCategories(gift.id);
  })();
  const moved = findGiftRow(gift.id);
  if (moved === null) throw new NotFoundError();
  return moved;
}

export function ownerBookingFor(gift: GiftWithBookingRow, wishlist: WishlistRow): BookingView | null {
  return ownerBookingView(gift, wishlist.show_booked === 1, wishlist.show_booker_names === 1);
}

/** Одиночный подарок владельцу: ссылки и теги — отдельными запросами. */
export function toOwnerGiftDTO(gift: GiftWithBookingRow, wishlist: WishlistRow): GiftDTO {
  const categories = loadGiftCategories([gift.id]).get(gift.id) ?? [];
  return toGiftDTO(gift, ownerBookingFor(gift, wishlist), getGiftLinks(gift.id), categories);
}

/** Список подарков владельцу: ссылки и теги для всех — пакетно, без N+1. */
export function toOwnerGiftDTOs(wishlist: WishlistRow, gifts: GiftWithBookingRow[]): GiftDTO[] {
  const giftIds = gifts.map((gift) => gift.id);
  const linksByGift = loadGiftLinks(giftIds);
  const categoriesByGift = loadGiftCategories(giftIds);
  return gifts.map((gift) =>
    toGiftDTO(
      gift,
      ownerBookingFor(gift, wishlist),
      linksByGift.get(gift.id) ?? [],
      categoriesByGift.get(gift.id) ?? [],
    ),
  );
}

/** Гостевой вид: имя бронирующего не показывается даже при включённом показе. */
export function toGuestGiftDTOs(gifts: GiftWithBookingRow[]): GiftDTO[] {
  const giftIds = gifts.map((gift) => gift.id);
  const linksByGift = loadGiftLinks(giftIds);
  const categoriesByGift = loadGiftCategories(giftIds);
  return gifts.map((gift) =>
    toGiftDTO(
      gift,
      guestBookingView(gift),
      linksByGift.get(gift.id) ?? [],
      categoriesByGift.get(gift.id) ?? [],
    ),
  );
}

import { getDb } from '../../db/index.ts';
import { AppError, NotFoundError } from '../../errors.ts';
import { newId, newShareToken } from '../../lib/crypto.ts';
import { isUniqueConstraintError, uniqueConstraintField } from '../../lib/db-errors.ts';
import { toWishlistSummaryDTO } from '../../lib/dto.ts';
import type { WishlistSummaryDTO } from '../../lib/dto.ts';
import type { WishlistRow, WishlistWithCountRow } from '../../lib/rows.ts';
import { isThemeEmoji } from '../../lib/schemas.ts';
import { isFollowing } from '../follows/follows.service.ts';
import type { CreateWishlistInput, UpdateWishlistInput } from './wishlists.schemas.ts';

const WISHLIST_SELECT = `
  SELECT w.*, (SELECT COUNT(*) FROM gifts g WHERE g.wishlist_id = w.id) AS gift_count
    FROM wishlists w`;

const SHOW_NAMES_REQUIRES_BOOKED = 'Показывать имена бронирующих можно только при включённом показе броней.';
const INVALID_THEME_COLOR_MESSAGE = 'Неверный цвет. Укажите цвет в формате #RRGGBB.';
const INVALID_EMOJI_MESSAGE = 'Неверный эмодзи. Выберите один эмодзи (1–8 символов).';
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * themeColor: undefined — не передано (при PATCH не трогаем), null — без темы,
 * любой цвет #RRGGBB — тема; всё остальное → 400 INVALID_COLOR.
 */
function normalizeThemeColor(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const candidate = value.trim();
    if (HEX_COLOR.test(candidate)) return candidate.toUpperCase();
  }
  throw new AppError(400, 'INVALID_COLOR', INVALID_THEME_COLOR_MESSAGE);
}

/**
 * themeEmoji: undefined — не передано (при PATCH не трогаем), null — без
 * эмодзи, валидный эмодзи — оформление; всё остальное → 400 INVALID_EMOJI.
 */
function normalizeThemeEmoji(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isThemeEmoji(value)) throw new AppError(400, 'INVALID_EMOJI', INVALID_EMOJI_MESSAGE);
  return value.trim();
}

export function listOwnerWishlists(ownerId: string): WishlistWithCountRow[] {
  return getDb()
    .prepare(`${WISHLIST_SELECT} WHERE w.owner_id = ? ORDER BY w.sort_order, w.created_at`)
    .all(ownerId) as WishlistWithCountRow[];
}

/** Вишлист владельца; чужой/несуществующий неотличимы — 404. */
export function getOwnerWishlist(wishlistId: string, ownerId: string): WishlistRow {
  const row = getDb()
    .prepare('SELECT * FROM wishlists WHERE id = ? AND owner_id = ?')
    .get(wishlistId, ownerId);
  if (!row) throw new NotFoundError();
  return row as WishlistRow;
}

/**
 * Вишлист по ссылке без проверки доступа — правила смотрит `canViewWishlist`.
 * Так `followers`-списки тоже находятся по токену, но открываются только своим.
 */
export function findWishlistByShareToken(shareToken: string): WishlistRow | null {
  const row = getDb().prepare('SELECT * FROM wishlists WHERE share_token = ?').get(shareToken);
  return row ? (row as WishlistRow) : null;
}

/**
 * Может ли смотрящий открыть вишлист по ссылке:
 * - public/link — да (ссылка и есть доступ);
 * - followers — только сам владелец или его подписчик; гостю/неподписчику 404.
 */
export function canViewWishlist(wishlist: WishlistRow, viewerId: string | null): boolean {
  switch (wishlist.visibility) {
    case 'public':
    case 'link':
      return true;
    case 'followers':
      if (viewerId === null) return false;
      if (wishlist.owner_id === viewerId) return true;
      return isFollowing(viewerId, wishlist.owner_id);
    default:
      return false;
  }
}

export function countGifts(wishlistId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS count FROM gifts WHERE wishlist_id = ?')
    .get(wishlistId) as { count: number };
  return row.count;
}

function nextWishlistSortOrder(ownerId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM wishlists WHERE owner_id = ?')
    .get(ownerId) as { max_order: number };
  return row.max_order + 1;
}

export function createWishlist(ownerId: string, input: CreateWishlistInput): WishlistRow {
  const db = getDb();
  const id = newId();
  const now = new Date().toISOString();
  const sortOrder = nextWishlistSortOrder(ownerId);
  const visibility = input.visibility ?? 'public';
  const themeColor = normalizeThemeColor(input.themeColor) ?? null;
  const themeEmoji = normalizeThemeEmoji(input.themeEmoji) ?? null;

  // share_token — короткий код (7 символов), поэтому коллизии возможны;
  // до 5 попыток, дальше честный 500 (крайне маловероятно).
  let created = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      db.prepare(
        `INSERT INTO wishlists
           (id, owner_id, title, description, event_date, visibility, share_token, sort_order,
            show_booked, show_booker_names, theme_color, theme_emoji, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      ).run(
        id,
        ownerId,
        input.title,
        input.description ?? null,
        input.eventDate ?? null,
        visibility,
        newShareToken(),
        sortOrder,
        themeColor,
        themeEmoji,
        now,
        now,
      );
      created = true;
      break;
    } catch (error) {
      const field = uniqueConstraintField(error);
      if (!isUniqueConstraintError(error) || field !== 'wishlists.share_token') throw error;
    }
  }

  if (!created) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Не удалось создать вишлист. Попробуйте ещё раз.');
  }
  const row = db.prepare('SELECT * FROM wishlists WHERE id = ?').get(id);
  if (!row) throw new Error('Не удалось создать вишлист');
  return row as WishlistRow;
}

/**
 * Перевыпуск короткой ссылки: новый токен 7 символов, старый перестаёт работать.
 * Нужен для вишлистов, созданных до перехода на короткие ссылки.
 */
export function regenerateShareToken(wishlist: WishlistRow): WishlistRow {
  const db = getDb();
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = newShareToken();
    try {
      db.prepare('UPDATE wishlists SET share_token = ?, updated_at = ? WHERE id = ?').run(
        token,
        now,
        wishlist.id,
      );
      return { ...wishlist, share_token: token, updated_at: now };
    } catch (error) {
      const field = uniqueConstraintField(error);
      if (!isUniqueConstraintError(error) || field !== 'wishlists.share_token') throw error;
    }
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Не удалось обновить ссылку. Попробуйте ещё раз.');
}

export function updateWishlist(wishlist: WishlistRow, input: UpdateWishlistInput): WishlistRow {
  const title = input.title ?? wishlist.title;
  const description = input.description === undefined ? wishlist.description : input.description;
  const eventDate = input.eventDate === undefined ? wishlist.event_date : input.eventDate;
  const visibility = input.visibility ?? wishlist.visibility;
  const themeColor =
    input.themeColor === undefined
      ? wishlist.theme_color
      : (normalizeThemeColor(input.themeColor) ?? null);
  const themeEmoji =
    input.themeEmoji === undefined
      ? wishlist.theme_emoji
      : (normalizeThemeEmoji(input.themeEmoji) ?? null);
  const showBooked = input.showBooked === undefined ? wishlist.show_booked === 1 : input.showBooked;

  let showBookerNames: boolean;
  if (input.showBookerNames === true) {
    // Явно включить имена без показа броней нельзя — 422, а не «молча включим».
    if (!showBooked) throw new AppError(422, 'SHOW_NAMES_REQUIRES_BOOKED', SHOW_NAMES_REQUIRES_BOOKED);
    showBookerNames = true;
  } else if (input.showBookerNames === false) {
    showBookerNames = false;
  } else {
    // Выключение показа броней безопасно гасит и показ имён (CHECK в БД).
    showBookerNames = showBooked && wishlist.show_booker_names === 1;
  }

  getDb()
    .prepare(
      `UPDATE wishlists
          SET title = ?, description = ?, event_date = ?, visibility = ?,
              show_booked = ?, show_booker_names = ?, theme_color = ?, theme_emoji = ?,
              updated_at = ?
        WHERE id = ?`,
    )
    .run(
      title,
      description,
      eventDate,
      visibility,
      showBooked ? 1 : 0,
      showBookerNames ? 1 : 0,
      themeColor,
      themeEmoji,
      new Date().toISOString(),
      wishlist.id,
    );

  const row = getDb().prepare('SELECT * FROM wishlists WHERE id = ?').get(wishlist.id);
  if (!row) throw new NotFoundError();
  return row as WishlistRow;
}

export function deleteWishlist(wishlist: WishlistRow): void {
  // Подарки и брони удаляются каскадно (ON DELETE CASCADE).
  getDb().prepare('DELETE FROM wishlists WHERE id = ?').run(wishlist.id);
}

/** Сохраняет путь к обложке (относительно uploads/) и обновляет updated_at. */
export function setWishlistCover(wishlist: WishlistRow, storedPath: string): WishlistRow {
  getDb()
    .prepare('UPDATE wishlists SET cover_path = ?, updated_at = ? WHERE id = ?')
    .run(storedPath, new Date().toISOString(), wishlist.id);
  const row = getDb().prepare('SELECT * FROM wishlists WHERE id = ?').get(wishlist.id);
  if (!row) throw new NotFoundError();
  return row as WishlistRow;
}

/** Убирает обложку из БД (файл удаляет вызывающий код). */
export function clearWishlistCover(wishlist: WishlistRow): WishlistRow {
  getDb()
    .prepare('UPDATE wishlists SET cover_path = NULL, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), wishlist.id);
  const row = getDb().prepare('SELECT * FROM wishlists WHERE id = ?').get(wishlist.id);
  if (!row) throw new NotFoundError();
  return row as WishlistRow;
}

export function reorderWishlists(ownerId: string, order: string[]): void {
  const db = getDb();
  const owned = db
    .prepare('SELECT id FROM wishlists WHERE owner_id = ?')
    .all(ownerId) as Array<{ id: string }>;
  const ownedIds = new Set(owned.map((row) => row.id));
  for (const wishlistId of order) {
    if (!ownedIds.has(wishlistId)) throw new NotFoundError();
  }
  const update = db.prepare('UPDATE wishlists SET sort_order = ? WHERE id = ? AND owner_id = ?');
  db.transaction(() => {
    order.forEach((wishlistId, index) => update.run(index, wishlistId, ownerId));
  })();
}

export interface ProfileWishlistAccess {
  /** Владелец видит все свои списки. */
  isOwner: boolean;
  /** Подписчик дополнительно видит списки visibility='followers'. */
  isFollower: boolean;
}

/**
 * Вишлисты в публичном профиле:
 * - владелец — все;
 * - подписчик — public + followers;
 * - остальные — только public.
 * `link` в списке профиля не показывается никогда (только по токену).
 */
export function listProfileWishlists(
  ownerId: string,
  access: ProfileWishlistAccess,
): WishlistSummaryDTO[] {
  let visibilityFilter: string;
  if (access.isOwner) visibilityFilter = '';
  else if (access.isFollower) visibilityFilter = " AND w.visibility IN ('public', 'followers')";
  else visibilityFilter = " AND w.visibility = 'public'";

  const rows = getDb()
    .prepare(
      `${WISHLIST_SELECT} WHERE w.owner_id = ?${visibilityFilter} ORDER BY w.sort_order, w.created_at`,
    )
    .all(ownerId) as WishlistWithCountRow[];
  return rows.map((row) => toWishlistSummaryDTO(row, row.gift_count));
}

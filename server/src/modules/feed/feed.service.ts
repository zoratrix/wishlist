import { getDb } from '../../db/index.ts';
import type {
  FeedBirthdayItemDTO,
  FeedItemDTO,
  FeedUserDTO,
  FeedWishlistItemDTO,
} from '../../lib/dto.ts';
import { toPublicUploadUrl } from '../../lib/upload-paths.ts';

const RECENT_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;
const BIRTHDAY_WINDOW_DAYS = 30;
const MAX_WISHLIST_ITEMS = 20;
const MAX_BIRTHDAY_ITEMS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface WishlistFeedRow {
  id: string;
  title: string;
  share_token: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
}

interface BirthdayFeedRow {
  username: string;
  display_name: string;
  avatar_path: string | null;
  birth_month: number;
  birth_day: number;
}

export interface BirthdayOccurrence {
  /** Ближайшая дата рождения (локальная полночь). */
  at: Date;
  /** MM-DD фактической даты (29.02 в невисокосный год → 28.02). */
  date: string;
  inDays: number;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Ближайший день рождения в пределах 30 дней. 29 февраля в невисокосный год
 * считается 28 февраля (по спецификации). Возвращает null, если ближайшая дата
 * дальше окна.
 */
export function nextBirthdayOccurrence(
  month: number,
  day: number,
  today: Date,
): BirthdayOccurrence | null {
  const base = startOfLocalDay(today);

  for (let yearOffset = 0; yearOffset <= 1; yearOffset += 1) {
    const candidateYear = base.getFullYear() + yearOffset;
    const candidateDay =
      month === 2 && day === 29 && !isLeapYear(candidateYear) ? 28 : day;
    const candidate = new Date(candidateYear, month - 1, candidateDay);
    if (candidate.getTime() < base.getTime()) continue;

    const inDays = daysBetween(base, candidate);
    if (inDays > BIRTHDAY_WINDOW_DAYS) return null;
    return {
      at: candidate,
      date: `${String(month).padStart(2, '0')}-${String(candidateDay).padStart(2, '0')}`,
      inDays,
    };
  }
  return null;
}

function toFeedUser(row: {
  username: string;
  display_name: string;
  avatar_path: string | null;
}): FeedUserDTO {
  return {
    username: row.username,
    displayName: row.display_name,
    avatarPath: toPublicUploadUrl(row.avatar_path),
  };
}

/**
 * Лента подписок:
 * 1) свежие вишлисты подписок (public|followers, не link) за 60 дней — до 20,
 *    сначала самые новые;
 * 2) ближайшие дни рождения подписок (в пределах 30 дней) — до 10, сначала
 *    самые близкие.
 */
export function getFeed(viewerId: string, now: Date = new Date()): FeedItemDTO[] {
  const db = getDb();
  const since = new Date(now.getTime() - RECENT_WINDOW_MS).toISOString();

  const wishlistRows = db
    .prepare(
      `SELECT w.id, w.title, w.share_token, w.created_at,
              u.username, u.display_name, u.avatar_path
         FROM follows f
         JOIN wishlists w ON w.owner_id = f.following_id
         JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ?
          AND w.visibility IN ('public', 'followers')
          AND w.created_at >= ?
        ORDER BY w.created_at DESC, w.id
        LIMIT ?`,
    )
    .all(viewerId, since, MAX_WISHLIST_ITEMS) as WishlistFeedRow[];

  const wishlistItems: FeedWishlistItemDTO[] = wishlistRows.map((row) => ({
    type: 'wishlist',
    at: row.created_at,
    wishlist: {
      id: row.id,
      title: row.title,
      shareToken: row.share_token,
      owner: toFeedUser(row),
    },
  }));

  const birthdayRows = db
    .prepare(
      `SELECT u.username, u.display_name, u.avatar_path, u.birth_month, u.birth_day
         FROM follows f
         JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ?
          AND u.birth_month IS NOT NULL
          AND u.birth_day IS NOT NULL`,
    )
    .all(viewerId) as BirthdayFeedRow[];

  const birthdays: Array<FeedBirthdayItemDTO & { sortKey: number }> = [];
  for (const row of birthdayRows) {
    const occurrence = nextBirthdayOccurrence(row.birth_month, row.birth_day, now);
    if (occurrence === null) continue;
    birthdays.push({
      type: 'birthday',
      at: occurrence.at.toISOString(),
      date: occurrence.date,
      inDays: occurrence.inDays,
      user: toFeedUser(row),
      sortKey: occurrence.inDays,
    });
  }
  birthdays.sort(
    (left, right) => left.sortKey - right.sortKey || left.user.username.localeCompare(right.user.username, 'ru'),
  );

  const birthdayItems: FeedBirthdayItemDTO[] = birthdays
    .slice(0, MAX_BIRTHDAY_ITEMS)
    .map(({ sortKey: _sortKey, ...item }) => item);

  return [...wishlistItems, ...birthdayItems];
}

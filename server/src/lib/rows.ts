/**
 * Строки таблиц в том виде, в каком их возвращает better-sqlite3 (snake_case).
 * В ответы API эти объекты не попадают напрямую — только через `dto.ts`,
 * чтобы приватные поля (email бронирующего и т.п.) не утекали по ошибке.
 */

export interface UserRow {
  id: string;
  email: string;
  email_verified_at: string | null;
  password_hash: string | null;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  show_birth_year: number;
  timezone: string;
  is_profile_public: number;
  created_at: string;
  updated_at: string;
}

/** Строка follows: кто на кого подписан и когда. */
export interface FollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

/** Пользователь вместе с датой подписки — для списков подписчиков/подписок. */
export interface FollowUserRow extends UserRow {
  followed_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip_hash: string | null;
  user_agent: string | null;
}

/** Одноразовая ссылка для восстановления пароля (в БД — только хеш токена). */
export interface PasswordResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export type WishlistVisibility = 'public' | 'link' | 'followers';

export interface WishlistRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover_path: string | null;
  event_date: string | null;
  visibility: WishlistVisibility;
  share_token: string;
  sort_order: number;
  show_booked: number;
  show_booker_names: number;
  /** Цвет-тема вишлиста (из палитры) или NULL. */
  theme_color: string | null;
  /** Эмодзи-оформление вишлиста или NULL («без эмодзи»). */
  theme_emoji: string | null;
  created_at: string;
  updated_at: string;
}

export type GiftStatus = 'available' | 'gifted';

export interface GiftRow {
  id: string;
  wishlist_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  price_minor: number | null;
  currency: string;
  priority: number;
  status: GiftStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Подарок вместе с активной бронью (LEFT JOIN bookings ... cancelled_at IS NULL). */
export interface GiftWithBookingRow extends GiftRow {
  booking_name: string | null;
  booking_created_at: string | null;
}

/** Ссылка на товар (отдельная строка: у подарка их 0–10, с порядком). */
export interface GiftLinkRow {
  id: string;
  gift_id: string;
  url: string;
  sort_order: number;
  created_at: string;
}

/** Категория (тег) вишлиста: название уникально внутри списка. */
export interface CategoryRow {
  id: string;
  wishlist_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface BookingRow {
  id: string;
  gift_id: string;
  customer_name: string;
  customer_email: string;
  customer_email_norm: string;
  created_at: string;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

/** Вишлист вместе с числом подарков (подзапрос COUNT). */
export interface WishlistWithCountRow extends WishlistRow {
  gift_count: number;
}

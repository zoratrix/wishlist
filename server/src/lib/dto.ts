import type {
  CategoryRow,
  FollowUserRow,
  GiftStatus,
  GiftWithBookingRow,
  GiftRow,
  UserRow,
  WishlistRow,
  WishlistVisibility,
} from './rows.ts';
import { toPublicUploadUrl } from './upload-paths.ts';

/**
 * DTO-слой: единственное место, где строки БД превращаются в ответы API.
 * Здесь же реализованы правила приватности — DTO собирается по роли смотрящего.
 */

export interface UserSelfDTO {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  showBirthYear: boolean;
  isProfilePublic: boolean;
  /** Счётчики видит только владелец аккаунта (в публичном DTO их нет). */
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

/** Счётчики подписок (только для UserSelfDTO). */
export interface FollowCounts {
  followersCount: number;
  followingCount: number;
}

/** Строка списка подписчиков/подписок (этап 3). */
export interface FollowUserDTO {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
  followedAt: string;
}

/** Отношение смотрящего к публичному профилю. */
export interface ProfileViewerDTO {
  isSelf: boolean;
  isFollowing: boolean;
  canFollow: boolean;
}

/** Пользователь в ленте (подписки): аватар — URL или null. */
export interface FeedUserDTO {
  username: string;
  displayName: string;
  avatarPath: string | null;
}

export interface FeedWishlistDTO {
  id: string;
  title: string;
  shareToken: string;
  owner: FeedUserDTO;
}

export interface FeedWishlistItemDTO {
  type: 'wishlist';
  at: string;
  wishlist: FeedWishlistDTO;
}

export interface FeedBirthdayItemDTO {
  type: 'birthday';
  at: string;
  /** Ближайшая дата рождения в формате MM-DD. */
  date: string;
  /** Через сколько дней (0 — сегодня). */
  inDays: number;
  user: FeedUserDTO;
}

export type FeedItemDTO = FeedWishlistItemDTO | FeedBirthdayItemDTO;

export interface UserPublicDTO {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  birthYear: number | null;
  showBirthYear: boolean;
  isProfilePublic: boolean;
  createdAt: string;
}

export interface WishlistSummaryDTO {
  id: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  eventDate: string | null;
  visibility: WishlistVisibility;
  shareToken: string;
  sortOrder: number;
  showBooked: boolean;
  showBookerNames: boolean;
  /** Цвет-тема вишлиста (палитра) или null. */
  themeColor: string | null;
  /** Эмодзи-оформление вишлиста или null. */
  themeEmoji: string | null;
  giftCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Вид брони для смотрящего; email/время брони сюда не попадают никогда. */
export interface BookingView {
  status: 'booked';
  bookerName?: string;
}

/** Категория (тег) вишлиста — публичные данные списка. */
export interface CategoryDTO {
  id: string;
  name: string;
  /** Цвет из палитры или null («по умолчанию»). */
  color: string | null;
}

export interface GiftDTO {
  id: string;
  title: string;
  description: string | null;
  /** Ссылки на товар в порядке пользователя (0–10), без дубликатов. */
  links: string[];
  /** Теги подарка (0–5), по алфавиту. */
  categories: CategoryDTO[];
  priceMinor: number | null;
  currency: string;
  priority: number;
  status: GiftStatus;
  sortOrder: number;
  booking: BookingView | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistOwnerViewDTO {
  username: string;
  displayName: string;
  isProfilePublic: boolean;
}

export interface WishlistPublicDTO {
  id: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  eventDate: string | null;
  visibility: WishlistVisibility;
  themeColor: string | null;
  themeEmoji: string | null;
  updatedAt: string;
  owner: WishlistOwnerViewDTO;
}

export function toUserSelfDTO(user: UserRow, counts: FollowCounts): UserSelfDTO {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    birthMonth: user.birth_month,
    birthDay: user.birth_day,
    birthYear: user.birth_year,
    showBirthYear: user.show_birth_year === 1,
    isProfilePublic: user.is_profile_public === 1,
    followersCount: counts.followersCount,
    followingCount: counts.followingCount,
    avatarPath: toPublicUploadUrl(user.avatar_path),
    createdAt: user.created_at,
  };
}

/** Пользователь в списке подписок: дата — когда подписался (смотрящий → цель). */
export function toFollowUserDTO(row: FollowUserRow): FollowUserDTO {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarPath: toPublicUploadUrl(row.avatar_path),
    followedAt: row.followed_at,
  };
}

/** Публичный профиль: без email; год рождения — только при showBirthYear. */
export function toUserPublicDTO(user: UserRow): UserPublicDTO {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    bio: user.bio,
    avatarPath: toPublicUploadUrl(user.avatar_path),
    birthMonth: user.birth_month,
    birthDay: user.birth_day,
    birthYear: user.show_birth_year === 1 ? user.birth_year : null,
    showBirthYear: user.show_birth_year === 1,
    isProfilePublic: user.is_profile_public === 1,
    createdAt: user.created_at,
  };
}

export function toWishlistSummaryDTO(wishlist: WishlistRow, giftCount: number): WishlistSummaryDTO {
  return {
    id: wishlist.id,
    title: wishlist.title,
    description: wishlist.description,
    coverPath: toPublicUploadUrl(wishlist.cover_path),
    eventDate: wishlist.event_date,
    visibility: wishlist.visibility,
    shareToken: wishlist.share_token,
    sortOrder: wishlist.sort_order,
    showBooked: wishlist.show_booked === 1,
    showBookerNames: wishlist.show_booker_names === 1,
    themeColor: wishlist.theme_color,
    themeEmoji: wishlist.theme_emoji,
    giftCount,
    createdAt: wishlist.created_at,
    updatedAt: wishlist.updated_at,
  };
}

/**
 * Ссылки и категории передаются отдельно от строки подарка: для списков они
 * собираются пакетно (см. gifts.service), поэтому N+1 не возникает.
 */
export function toGiftDTO(
  gift: GiftRow,
  booking: BookingView | null,
  links: string[],
  categories: CategoryDTO[],
): GiftDTO {
  return {
    id: gift.id,
    title: gift.title,
    description: gift.description,
    links,
    categories,
    priceMinor: gift.price_minor,
    currency: gift.currency,
    priority: gift.priority,
    status: gift.status,
    sortOrder: gift.sort_order,
    booking,
    createdAt: gift.created_at,
    updatedAt: gift.updated_at,
  };
}

export function toWishlistPublicDTO(wishlist: WishlistRow, owner: UserRow): WishlistPublicDTO {
  return {
    id: wishlist.id,
    title: wishlist.title,
    description: wishlist.description,
    coverPath: toPublicUploadUrl(wishlist.cover_path),
    eventDate: wishlist.event_date,
    visibility: wishlist.visibility,
    themeColor: wishlist.theme_color,
    themeEmoji: wishlist.theme_emoji,
    updatedAt: wishlist.updated_at,
    owner: {
      username: owner.username,
      displayName: owner.display_name,
      isProfilePublic: owner.is_profile_public === 1,
    },
  };
}

export function toCategoryDTO(category: CategoryRow): CategoryDTO {
  return { id: category.id, name: category.name, color: category.color };
}

/** Теги во всех ответах идут по алфавиту (с учётом русской локали). */
export function sortCategoryDTOs(categories: CategoryDTO[]): CategoryDTO[] {
  return [...categories].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

export function toCategoryDTOs(categories: CategoryRow[]): CategoryDTO[] {
  return sortCategoryDTOs(categories.map(toCategoryDTO));
}

/**
 * Бронь глазами гостя: только факт «занято», без имени и каких-либо деталей.
 * Имя бронирующего гостю недоступно даже при включённом показе у владельца.
 */
export function guestBookingView(gift: GiftWithBookingRow): BookingView | null {
  return gift.booking_created_at === null ? null : { status: 'booked' };
}

/**
 * Бронь глазами владельца:
 * - showBooked=false → поля брони нет вовсе (null, «как будто не бронировали»);
 * - showBooked=true, showBookerNames=false → только { status: 'booked' };
 * - showBooked=true, showBookerNames=true → плюс имя (не email!).
 */
export function ownerBookingView(
  gift: GiftWithBookingRow,
  showBooked: boolean,
  showBookerNames: boolean,
): BookingView | null {
  if (!showBooked || gift.booking_created_at === null) return null;
  if (showBookerNames && gift.booking_name !== null) {
    return { status: 'booked', bookerName: gift.booking_name };
  }
  return { status: 'booked' };
}

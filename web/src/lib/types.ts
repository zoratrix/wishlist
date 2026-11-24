/** Формы данных API этапа 2 — см. docs/API-CONTRACT-MVP.md. */

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
  createdAt: string;
  /** Счётчики приходят только в собственном профиле (этап 3). */
  followersCount?: number;
  followingCount?: number;
}

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

/** Арендатор видит только `{ status: 'booked' }`; имя — лишь владельцу при showBookerNames. */
export interface BookingDTO {
  status: 'booked';
  bookerName?: string;
}

export interface ProfileViewer {
  isSelf: boolean;
  isFollowing: boolean;
  canFollow: boolean;
}

export interface PublicProfileResponse {
  user: UserPublicDTO;
  wishlists: WishlistSummaryDTO[];
  viewer: ProfileViewer;
}

export interface FollowUserDTO {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
  followedAt: string;
}

export interface FollowListResponse {
  users: FollowUserDTO[];
  total: number;
}

export interface FollowToggleResponse {
  isFollowing: boolean;
}

export type GiftStatus = 'available' | 'gifted';

/** Категория-тег в рамках одного вишлиста. */
export interface CategoryDTO {
  id: string;
  name: string;
  /** Цвет из палитры или null («по умолчанию», нейтральный вид). */
  color: string | null;
}

export interface GiftDTO {
  id: string;
  title: string;
  description: string | null;
  links: string[];
  categories: CategoryDTO[];
  priceMinor: number | null;
  currency: string;
  priority: number;
  status: GiftStatus;
  sortOrder: number;
  booking: BookingDTO | null;
  createdAt: string;
  updatedAt: string;
}

export type Visibility = 'public' | 'link' | 'followers';

export interface WishlistSummaryDTO {
  id: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  /** Цвет темы оформления из палитры или null («по умолчанию»). */
  themeColor: string | null;
  /** Эмодзи-фон страницы списка или null (без эмодзи). */
  themeEmoji?: string | null;
  eventDate: string | null;
  visibility: Visibility;
  shareToken: string;
  sortOrder: number;
  showBooked: boolean;
  showBookerNames: boolean;
  giftCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedUser {
  username: string;
  displayName: string;
  avatarPath: string | null;
}

export type FeedItem =
  | {
      type: 'wishlist';
      at: string;
      wishlist: {
        id: string;
        title: string;
        shareToken: string;
        owner: FeedUser;
      };
    }
  | {
      type: 'birthday';
      at: string;
      date: string;
      inDays: number;
      user: FeedUser;
    };

export interface FeedResponse {
  items: FeedItem[];
}

export interface MeResponse {
  user: UserSelfDTO | null;
}

export interface WishlistsResponse {
  wishlists: WishlistSummaryDTO[];
}

export interface WishlistDetailResponse {
  wishlist: WishlistSummaryDTO;
  gifts: GiftDTO[];
  categories: CategoryDTO[];
}

export interface PublicWishlistOwner {
  username: string;
  displayName: string;
  isProfilePublic: boolean;
}

export interface PublicWishlist {
  id: string;
  title: string;
  description: string | null;
  coverPath?: string | null;
  themeColor?: string | null;
  themeEmoji?: string | null;
  updatedAt?: string;
  eventDate: string | null;
  visibility: Visibility;
  owner: PublicWishlistOwner;
}

export interface PublicWishlistResponse {
  wishlist: PublicWishlist;
  gifts: GiftDTO[];
  categories: CategoryDTO[];
}

export interface CategoryResponse {
  category: CategoryDTO;
}

export interface AuthResponse {
  user: UserSelfDTO;
}

export interface WishlistResponse {
  wishlist: WishlistSummaryDTO;
}

export interface GiftResponse {
  gift: GiftDTO;
}

export interface BookGiftResponse {
  booking: { createdAt: string };
}

export interface UnbookGiftResponse {
  ok: true;
}

export interface ProfileUpdatePayload {
  displayName?: string;
  bio?: string | null;
  birthMonth?: number | null;
  birthDay?: number | null;
  birthYear?: number | null;
  showBirthYear?: boolean;
  isProfilePublic?: boolean;
}

import type { Express } from 'express';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { createApp } from '../src/app.ts';
import { getDb } from '../src/db/index.ts';
import { resetRateLimits } from '../src/lib/rate-limit.ts';

/** Отдельное приложение на каждый тест: без отдачи собранного сайта. */
export function createTestApp(): Express {
  return createApp({ serveBuiltSite: false });
}

/** Чистая база между сценариями (миграции уже применены в setup.ts). */
export function resetDatabase(): void {
  getDb().exec(`
    DELETE FROM password_resets;
    DELETE FROM booking_attempts;
    DELETE FROM bookings;
    DELETE FROM gifts;
    DELETE FROM wishlists;
    DELETE FROM sessions;
    DELETE FROM user_settings;
    DELETE FROM users;
  `);
}

export function resetAll(): void {
  resetRateLimits();
  resetDatabase();
}

export function extractCookie(response: SupertestResponse, name: string): string | null {
  const raw = response.headers['set-cookie'];
  const list: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  for (const cookie of list) {
    const pair = cookie.split(';')[0] ?? '';
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator) !== name) continue;
    return decodeURIComponent(pair.slice(separator + 1));
  }
  return null;
}

let sequence = 0;

export function uniqueSuffix(): string {
  sequence += 1;
  return `${Date.now().toString(36)}${sequence}`;
}

export interface AuthContext {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
  };
  email: string;
  password: string;
  sid: string;
  csrf: string;
  cookie: string;
}

export interface RegisterOverrides {
  email?: string;
  password?: string;
  displayName?: string;
  username?: string;
}

/** Регистрирует пользователя и возвращает cookie + CSRF-токен для запросов. */
export async function registerUser(
  app: Express,
  overrides: RegisterOverrides = {},
  ip = '10.0.0.1',
): Promise<AuthContext> {
  const suffix = uniqueSuffix();
  const payload = {
    email: overrides.email ?? `user_${suffix}@example.com`,
    password: overrides.password ?? 'password123',
    displayName: overrides.displayName ?? 'Тестовый пользователь',
    username: overrides.username ?? `user_${suffix}`,
  };
  const response = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', ip)
    .send(payload);
  if (response.status !== 201) {
    throw new Error(`Регистрация не удалась: ${response.status} ${JSON.stringify(response.body)}`);
  }
  const sid = extractCookie(response, 'sid');
  const csrf = extractCookie(response, 'csrf');
  if (sid === null || csrf === null) throw new Error('Сервер не выставил cookie сессии');
  return {
    user: response.body.user,
    email: payload.email,
    password: payload.password,
    sid,
    csrf,
    cookie: `sid=${sid}; csrf=${csrf}`,
  };
}

/** Заголовки авторизованного запроса; для POST/PATCH/DELETE добавляется CSRF. */
export function authHeaders(auth: AuthContext, unsafe = false): Record<string, string> {
  const headers: Record<string, string> = { Cookie: auth.cookie };
  if (unsafe) headers['X-CSRF-Token'] = auth.csrf;
  return headers;
}

export interface WishlistBody {
  id: string;
  title: string;
  description: string | null;
  coverPath: string | null;
  eventDate: string | null;
  visibility: string;
  shareToken: string;
  sortOrder: number;
  showBooked: boolean;
  showBookerNames: boolean;
  themeColor: string | null;
  themeEmoji: string | null;
  giftCount: number;
}

export async function createWishlist(
  app: Express,
  auth: AuthContext,
  overrides: Record<string, unknown> = {},
): Promise<WishlistBody> {
  const response = await request(app)
    .post('/api/me/wishlists')
    .set(authHeaders(auth, true))
    .send({ title: 'Мой список', ...overrides });
  if (response.status !== 201) {
    throw new Error(`Создание вишлиста не удалось: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.wishlist as WishlistBody;
}

export interface CategoryBody {
  id: string;
  name: string;
  color: string | null;
}

export interface GiftBody {
  id: string;
  title: string;
  description: string | null;
  links: string[];
  categories: CategoryBody[];
  priceMinor: number | null;
  currency: string;
  priority: number;
  status: string;
  sortOrder: number;
  booking: { status: string; bookerName?: string } | null;
}

export async function createGift(
  app: Express,
  auth: AuthContext,
  wishlistId: string,
  overrides: Record<string, unknown> = {},
): Promise<GiftBody> {
  const response = await request(app)
    .post(`/api/me/wishlists/${wishlistId}/gifts`)
    .set(authHeaders(auth, true))
    .send({ title: 'Подарок', ...overrides });
  if (response.status !== 201) {
    throw new Error(`Создание подарка не удалось: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.gift as GiftBody;
}

export async function createCategory(
  app: Express,
  auth: AuthContext,
  wishlistId: string,
  name: string,
  color?: string | null,
): Promise<CategoryBody> {
  const payload: Record<string, unknown> = { name };
  if (color !== undefined) payload.color = color;
  const response = await request(app)
    .post(`/api/me/wishlists/${wishlistId}/categories`)
    .set(authHeaders(auth, true))
    .send(payload);
  if (response.status !== 201) {
    throw new Error(`Создание категории не удалось: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.category as CategoryBody;
}

export function bookRequest(
  app: Express,
  shareToken: string,
  giftId: string,
  data: { name: string; email: string },
  ip = '10.10.0.1',
) {
  return request(app)
    .post(`/api/w/${shareToken}/gifts/${giftId}/book`)
    .set('X-Forwarded-For', ip)
    .send(data);
}

export function unbookRequest(
  app: Express,
  shareToken: string,
  giftId: string,
  email: string,
  ip = '10.10.0.1',
) {
  return request(app)
    .post(`/api/w/${shareToken}/gifts/${giftId}/unbook`)
    .set('X-Forwarded-For', ip)
    .send({ email });
}

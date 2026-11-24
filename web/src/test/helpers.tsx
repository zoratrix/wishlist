import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type {
 CategoryDTO,
 GiftDTO,
 PublicWishlist,
 UserSelfDTO,
 WishlistSummaryDTO,
} from '../lib/types';
import App from '../App';

export function jsonResponse(body: unknown, status = 200): Response {
 return {
 ok: status >= 200 && status < 300,
 status,
 text: async () => (status === 204 || body === undefined ? '' : JSON.stringify(body)),
 } as unknown as Response;
}

export interface ApiCall {
 method: string;
 path: string;
 body: unknown;
 headers: Record<string, string>;
}

export interface MockResult {
 status?: number;
 body?: unknown;
}

export type MockHandler = (call: ApiCall) => MockResult | Promise<MockResult>;

/**
 * Подмена fetch: маршруты вида «GET /api/auth/me».
 * Нереальный сервер не нужен — тесты полностью на моках.
 */
export function mockApi(routes: Record<string, MockHandler>) {
 const calls: ApiCall[] = [];

 const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
 const path = typeof input === 'string' ? input : String(input);
 const method = (init?.method ?? 'GET').toUpperCase();
 const headers = { ...((init?.headers as Record<string, string> | undefined) ?? {}) };
 let body: unknown = null;
 if (typeof init?.body === 'string') {
 try {
 body = JSON.parse(init.body);
 } catch {
 body = init.body;
 }
 } else if (typeof FormData !== 'undefined' && init?.body instanceof FormData) {
 // Multipart-загрузки (аватар, обложка): отдаём FormData как есть.
 body = init.body;
 }

 const call: ApiCall = { method, path, body, headers };
 calls.push(call);

 const handler = routes[`${method} ${path}`];
 if (!handler) {
 return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Ничего не найдено.' } }, 404);
 }

 const result = await handler(call);
 return jsonResponse(result.body, result.status ?? 200);
 });

 vi.stubGlobal('fetch', fetchMock);
 return { calls, fetchMock };
}

export function renderApp(initialPath = '/') {
 const queryClient = new QueryClient({
 defaultOptions: {
 queries: { retry: false, refetchOnWindowFocus: false },
 mutations: { retry: false },
 },
 });

 const result = render(
 <QueryClientProvider client={queryClient}>
 <MemoryRouter initialEntries={[initialPath]}>
 <App />
 </MemoryRouter>
 </QueryClientProvider>,
 );

 return { ...result, queryClient };
}

/** Подмена matchMedia: истина только для запроса min-width: 768px. */
export function stubMediaQuery(matches: boolean): void {
 vi.stubGlobal('matchMedia', (query: string) => ({
 matches: matches && query.includes('min-width: 768px'),
 media: query,
 onchange: null,
 addEventListener: () => undefined,
 removeEventListener: () => undefined,
 addListener: () => undefined,
 removeListener: () => undefined,
 dispatchEvent: () => false,
 }));
}

export function stubWideScreen(): void {
 stubMediaQuery(true);
}

export function stubMobileScreen(): void {
 stubMediaQuery(false);
}

export const TEST_USER: UserSelfDTO = {
 id: 'user-1',
 email: 'anna@example.com',
 username: 'anna',
 displayName: 'Анна',
 bio: null,
 avatarPath: null,
 birthMonth: 4,
 birthDay: 15,
 birthYear: 1992,
 showBirthYear: true,
 isProfilePublic: true,
 createdAt: '2026-11-12T09:00:00.000Z',
};

export function makeWishlist(overrides: Partial<WishlistSummaryDTO> = {}): WishlistSummaryDTO {
 return {
 id: 'list-1',
 title: 'День рождения',
 description: null,
 coverPath: null,
 themeColor: null,
 themeEmoji: null,
 eventDate: '2026-12-20',
 visibility: 'link',
 shareToken: 'anna-birthday-2026',
 sortOrder: 0,
 showBooked: false,
 showBookerNames: false,
 giftCount: 0,
 createdAt: '2026-11-12T09:00:00.000Z',
 updatedAt: '2026-11-12T09:00:00.000Z',
 ...overrides,
 };
}

export function makeGift(overrides: Partial<GiftDTO> = {}): GiftDTO {
 return {
 id: 'gift-1',
 title: 'Подарок',
 description: null,
 links: [],
 categories: [],
 priceMinor: null,
 currency: 'RUB',
 priority: 3,
 status: 'available',
 sortOrder: 0,
 booking: null,
 createdAt: '2026-11-12T09:00:00.000Z',
 updatedAt: '2026-11-12T09:00:00.000Z',
 ...overrides,
 };
}

export function makeCategory(
 id: string,
 name: string,
 color: string | null = null,
): CategoryDTO {
 return { id, name, color };
}

export function makePublicWishlist(overrides: Partial<PublicWishlist> = {}): PublicWishlist {
 return {
 id: 'list-1',
 title: 'День рождения',
 description: null,
 themeEmoji: null,
 eventDate: '2026-12-20',
 visibility: 'link',
 owner: { username: 'anna', displayName: 'Анна', isProfilePublic: true },
 ...overrides,
 };
}

/**
 * Мок редактора списка «list-1» с изменяемыми подарками и категориями
 * (stateful): GET после PATCH/POST отдаёт обновлённые данные, как сервер.
 */
export function mockEditorGifts(
 initialGifts: GiftDTO[],
 initialCategories: CategoryDTO[] = [],
 wishlistOverrides: Partial<WishlistSummaryDTO> = {},
) {
 let gifts = [...initialGifts];
 let categories = [...initialCategories];

 function resolveCategories(ids: unknown): CategoryDTO[] {
 if (!Array.isArray(ids)) {
 return [];
 }
 const wanted = ids as string[];
 return categories.filter((category) => wanted.includes(category.id));
 }

 const api = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: {
 ...makeWishlist({ id: 'list-1' }),
 giftCount: gifts.length,
 ...wishlistOverrides,
 },
 gifts,
 categories,
 },
 }),
 'PATCH /api/me/gifts/g1': (call) => {
 const payload = call.body as { categoryIds?: string[] } & Partial<GiftDTO>;
 gifts = gifts.map((gift) => {
 if (gift.id !== 'g1') {
 return gift;
 }
 const { categoryIds, ...rest } = payload;
 return {
 ...gift,
 ...rest,
 categories: categoryIds === undefined ? gift.categories : resolveCategories(categoryIds),
 };
 });
 return { body: { gift: gifts[0] } };
 },
 'POST /api/me/wishlists/list-1/gifts': (call) => {
 const payload = call.body as { categoryIds?: string[] } & Partial<GiftDTO>;
 const gift = makeGift({
 id: `g${gifts.length + 1}`,
 title: payload.title ?? 'Подарок',
 priority: payload.priority ?? 3,
 priceMinor: payload.priceMinor ?? null,
 links: payload.links ?? [],
 description: payload.description ?? null,
 categories: resolveCategories(payload.categoryIds),
 });
 gifts = [...gifts, gift];
 return { status: 201, body: { gift } };
 },
 'POST /api/me/gifts/g1/status': (call) => {
 const status = (call.body as { status: GiftDTO['status'] }).status;
 gifts = gifts.map((gift) => (gift.id === 'g1' ? { ...gift, status } : gift));
 return { body: { gift: gifts[0] } };
 },
 'DELETE /api/me/gifts/g1': () => {
 gifts = gifts.filter((gift) => gift.id !== 'g1');
 return { status: 204 };
 },
 'POST /api/me/wishlists/list-1/categories': (call) => {
 const body = call.body as { name: string; color?: string | null };
 const category = makeCategory(`c${categories.length + 1}`, body.name, body.color ?? null);
 categories = [...categories, category];
 return { status: 201, body: { category } };
 },
 'PATCH /api/me/categories/c1': (call) => {
 const patch = call.body as { name?: string; color?: string | null };
 categories = categories.map((category) =>
 category.id === 'c1' ? { ...category, ...patch } : category,
 );
 return { body: { category: categories.find((category) => category.id === 'c1') } };
 },
 'DELETE /api/me/categories/c1': () => {
 categories = categories.filter((category) => category.id !== 'c1');
 return { status: 204 };
 },
 });

 return {
 ...api,
 getGifts: () => gifts,
 getCategories: () => categories,
 };
}

/** Порядок подарков на экране: id в порядке отображения. */
export function renderedGiftIds(container: HTMLElement): string[] {
 return Array.from(container.querySelectorAll('[data-gift-id]'))
 .map((element) => element.getAttribute('data-gift-id') ?? '')
 .filter((id) => id !== '');
}

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
 makeGift,
 makePublicWishlist,
 makeWishlist,
 mockApi,
 renderApp,
 TEST_USER,
 GUEST_VIEWER,
} from '../test/helpers';
import type { ApiCall } from '../test/helpers';
import type { WishlistSummaryDTO } from '../lib/types';

const THEME = '#5A7BA6';
const EMOJI = '🎁';
const PUBLIC_EMOJI = '📚';

function settingsApi(initial: WishlistSummaryDTO = makeWishlist({ id: 'list-1' })) {
 let wishlist = initial;
 return mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({ body: { wishlist, gifts: [], categories: [] } }),
 'PATCH /api/me/wishlists/list-1': (call) => {
 wishlist = { ...wishlist, ...(call.body as Record<string, unknown>) };
 return { body: { wishlist } };
 },
 });
}

function findPatchCalls(calls: ApiCall[]): ApiCall[] {
 return calls.filter(
 (call) => call.method === 'PATCH' && call.path === '/api/me/wishlists/list-1',
 );
}

describe('оформление страницы вишлиста: тема и эмодзи-фон', () => {
 it('настройки сохраняют цвет темы и выбранный из набора эмодзи одним PATCH', async () => {
 const { calls } = settingsApi();

 renderApp('/app/lists/list-1/settings');
 await screen.findByRole('heading', { level: 1, name: 'Настройки списка' });

 fireEvent.click(screen.getByRole('button', { name: `Цвет темы ${THEME}` }));
 fireEvent.click(screen.getByRole('button', { name: `Эмодзи ${EMOJI}` }));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 expect(await screen.findByText('Настройки сохранены.')).toBeTruthy();

 const patch = findPatchCalls(calls)[0];
 expect(patch?.body).toMatchObject({ themeColor: THEME, themeEmoji: EMOJI });
 });

 it('свой эмодзи сохраняется, а «Без эмодзи» сбрасывает его в null', async () => {
 const { calls } = settingsApi();

 renderApp('/app/lists/list-1/settings');
 await screen.findByRole('heading', { level: 1, name: 'Настройки списка' });

 fireEvent.change(screen.getByLabelText('Свой эмодзи'), { target: { value: '🦄' } });
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 await waitFor(() => expect(findPatchCalls(calls)).toHaveLength(1));
 expect(findPatchCalls(calls)[0]?.body).toMatchObject({ themeEmoji: '🦄' });

 fireEvent.click(screen.getByRole('button', { name: 'Без эмодзи' }));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 await waitFor(() => expect(findPatchCalls(calls)).toHaveLength(2));
 expect(findPatchCalls(calls)[1]?.body).toMatchObject({ themeEmoji: null });
 });

 it('показывает ошибку API при недопустимом эмодзи', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: { wishlist: makeWishlist({ id: 'list-1' }), gifts: [], categories: [] },
 }),
 'PATCH /api/me/wishlists/list-1': () => ({
 status: 400,
 body: {
 error: { code: 'INVALID_EMOJI', message: 'Неверный эмодзи. Выберите один эмодзи.' },
 },
 }),
 });

 renderApp('/app/lists/list-1/settings');
 await screen.findByRole('heading', { level: 1, name: 'Настройки списка' });

 fireEvent.click(screen.getByRole('button', { name: `Эмодзи ${EMOJI}` }));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 expect(
 await screen.findByText('Неверный эмодзи. Выберите один эмодзи.'),
 ).toBeTruthy();
 });

 it('превью оформления показывает выбранные цвет и эмодзи', async () => {
 settingsApi();

 renderApp('/app/lists/list-1/settings');
 await screen.findByRole('heading', { level: 1, name: 'Настройки списка' });

 fireEvent.click(screen.getByRole('button', { name: `Цвет темы ${THEME}` }));
 fireEvent.click(screen.getByRole('button', { name: `Эмодзи ${EMOJI}` }));

 const preview = document.querySelector('[data-wl-preview="true"]');
 expect(preview).toBeTruthy();
 expect(preview?.textContent).toContain(EMOJI);
 expect(preview?.getAttribute('data-theme')).toBe(THEME);
 });

 it('редактор получает тему на всю страницу и слой эмодзи за контентом', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: makeWishlist({ id: 'list-1', themeColor: THEME, themeEmoji: EMOJI }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 const wrapper = document.querySelector('[data-wl-theme]') as HTMLElement | null;
 expect(wrapper).toBeTruthy();
 expect(wrapper?.getAttribute('data-wl-theme')).toBe(THEME);
 expect(wrapper?.style.getPropertyValue('--wl-accent')).toBe(THEME);
 expect(wrapper?.style.getPropertyValue('--wl-tint')).not.toBe('');
 expect(wrapper?.style.getPropertyValue('--wl-page-bg')).not.toBe('');

 // Фон страницы — очень светлый оттенок темы (отдельный слой на весь экран).
 const pageBackground = document.querySelector(
 '[data-wl-page-background]',
 ) as HTMLElement | null;
 expect(pageBackground).toBeTruthy();
 expect(pageBackground?.style.backgroundColor).toMatch(/rgba\(/);
 expect(pageBackground?.style.backgroundColor).toContain('0.18');
 expect(pageBackground?.className).toContain('pointer-events-none');

 const backdrop = document.querySelector('[data-wl-emoji-backdrop]') as HTMLElement | null;
 expect(backdrop).toBeTruthy();
 expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
 expect(backdrop?.style.pointerEvents).toBe('none');
 expect(Number(backdrop?.style.opacity)).toBeGreaterThanOrEqual(0.12);
 expect(Number(backdrop?.style.opacity)).toBeLessThanOrEqual(0.22);
 expect(backdrop?.style.filter).toMatch(/blur\([2-6](?:\.\d+)?px\)/);
 // z-index ниже контента.
 expect(Number(backdrop?.style.zIndex)).toBeGreaterThanOrEqual(0);

 const grid = backdrop?.querySelector('[data-wl-emoji-grid]') as HTMLElement | null;
 expect(grid?.style.gridTemplateColumns).toContain('repeat(8');
 const cells = backdrop?.querySelectorAll('[data-wl-emoji-cell]') ?? [];
 expect(cells.length).toBeGreaterThanOrEqual(48);
 expect(cells[0]?.textContent).toBe(EMOJI);

 // Шапка списка — тоже оттенок темы.
 const hero = document.querySelector('[data-cover]') as HTMLElement | null;
 expect(hero?.style.backgroundColor).toMatch(/rgba?\(/);
 });

 it('публичная страница получает тему и слой эмодзи', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'GET /api/w/token-1': () => ({
 body: {
 viewer: GUEST_VIEWER,
 wishlist: makePublicWishlist({
 themeColor: THEME,
 themeEmoji: PUBLIC_EMOJI,
 }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 const wrapper = document.querySelector('[data-wl-theme]') as HTMLElement | null;
 expect(wrapper?.getAttribute('data-wl-theme')).toBe(THEME);
 expect(wrapper?.getAttribute('data-wl-emoji')).toBe(PUBLIC_EMOJI);
 expect(wrapper?.style.getPropertyValue('--wl-accent')).toBe(THEME);

 const backdrop = document.querySelector('[data-wl-emoji-backdrop]') as HTMLElement | null;
 expect(backdrop).toBeTruthy();
 expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
 expect(backdrop?.style.filter).toMatch(/blur\(/);
 expect(backdrop?.querySelectorAll('[data-wl-emoji-cell]')[0]?.textContent).toBe(PUBLIC_EMOJI);
 });

 it('без themeEmoji слоя эмодзи нет, без themeColor оформление нейтральное', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: makeWishlist({ id: 'list-1' }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 const wrapper = document.querySelector('[data-wl-theme]') as HTMLElement | null;
 expect(wrapper?.getAttribute('data-wl-theme')).toBe('default');
 expect(wrapper?.style.getPropertyValue('--wl-accent')).toBe('');
 expect(wrapper?.style.getPropertyValue('--wl-tint')).toBe('');
 expect(document.querySelector('[data-wl-emoji-backdrop]')).toBeNull();
 expect(document.querySelector('[data-wl-page-background]')).toBeNull();
 });

 it('публичная страница без эмодзи не рисует слой, но тему сохраняет', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'GET /api/w/token-1': () => ({
 body: {
 viewer: GUEST_VIEWER,
 wishlist: makePublicWishlist({ themeColor: THEME, themeEmoji: null }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 expect(document.querySelector('[data-wl-emoji-backdrop]')).toBeNull();
 const wrapper = document.querySelector('[data-wl-theme]') as HTMLElement | null;
 expect(wrapper?.style.getPropertyValue('--wl-accent')).toBe(THEME);
 });

 it('эмодзи-фон работает и без выбранного цвета темы', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: makeWishlist({ id: 'list-1', themeColor: null, themeEmoji: '🎂' }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 const wrapper = document.querySelector('[data-wl-theme]') as HTMLElement | null;
 expect(wrapper?.getAttribute('data-wl-theme')).toBe('default');
 expect(document.querySelector('[data-wl-page-background]')).toBeNull();
 const backdrop = document.querySelector('[data-wl-emoji-backdrop]') as HTMLElement | null;
 expect(backdrop).toBeTruthy();
 expect(backdrop?.querySelectorAll('[data-wl-emoji-cell]')[0]?.textContent).toBe('🎂');
 });

 it('остальные страницы сайта не получают оформление вишлиста', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 });

 renderApp('/app');
 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();

 expect(document.querySelector('[data-wl-theme]')).toBeNull();
 expect(document.querySelector('[data-wl-emoji-backdrop]')).toBeNull();
 });
});

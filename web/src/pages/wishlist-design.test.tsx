import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import {
 makeGift,
 makePublicWishlist,
 makeWishlist,
 mockApi,
 renderApp,
 TEST_USER,
} from '../test/helpers';

beforeEach(() => {
 URL.createObjectURL = vi.fn(() => 'blob:cover-preview') as unknown as typeof URL.createObjectURL;
 URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
});

const THEME = '#5A7BA6';

function settingsApi(initial = makeWishlist({ id: 'list-1' })) {
 let wishlist = initial;
 return mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({ body: { wishlist, gifts: [], categories: [] } }),
 'PATCH /api/me/wishlists/list-1': (call) => {
 wishlist = { ...wishlist, ...(call.body as Record<string, unknown>) };
 return { body: { wishlist } };
 },
 'POST /api/me/wishlists/list-1/cover': () => {
 wishlist = { ...wishlist, coverPath: '/uploads/covers/c1.webp' };
 return { body: { wishlist } };
 },
 'DELETE /api/me/wishlists/list-1/cover': () => {
 wishlist = { ...wishlist, coverPath: null };
 return { body: { wishlist } };
 },
 });
}

describe('оформление вишлиста в настройках', () => {
 it('выбор темы отправляет themeColor в PATCH', async () => {
 const { calls } = settingsApi();

 renderApp('/app/lists/list-1/settings');
 expect(await screen.findByRole('heading', { level: 1, name: 'Настройки списка' })).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: `Цвет темы ${THEME}` }));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 expect(await screen.findByText('Настройки сохранены.')).toBeTruthy();
 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/wishlists/list-1',
 );
 expect(patchCall?.body).toMatchObject({ themeColor: THEME });
 });

 it('загружает обложку multipart-ом, показывает превью и удаляет её', async () => {
 const { calls } = settingsApi();

 renderApp('/app/lists/list-1/settings');
 await screen.findByRole('heading', { level: 1, name: 'Настройки списка' });

 const file = new File(['cover-bytes'], 'cover.png', { type: 'image/png' });
 fireEvent.change(screen.getByLabelText('Файл обложки'), { target: { files: [file] } });

 expect(await screen.findByText('Обложка обновлена.')).toBeTruthy();

 const uploadCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/cover',
 );
 expect(uploadCall?.body).toBeInstanceOf(FormData);
 expect((uploadCall?.body as FormData).get('file')).toBeInstanceOf(File);
 expect(URL.createObjectURL).toHaveBeenCalled();

 const cover = await screen.findByAltText('Обложка списка');
 expect(cover.getAttribute('src')).toBe('/uploads/covers/c1.webp');

 fireEvent.click(screen.getByRole('button', { name: 'Удалить обложку' }));
 expect(await screen.findByText('Обложка удалена.')).toBeTruthy();
 expect(
 calls.some(
 (call) =>
 call.method === 'DELETE' && call.path === '/api/me/wishlists/list-1/cover',
 ),
 ).toBe(true);
 expect(screen.queryByAltText('Обложка списка')).toBeNull();
 });
});

describe('обложка и тема на публичной странице и в редакторе', () => {
 it('публичная страница показывает обложку и цвет темы', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist({
 coverPath: '/uploads/covers/c1.webp',
 themeColor: THEME,
 }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 const cover = screen.getByAltText('Обложка вишлиста') as HTMLImageElement;
 expect(cover.getAttribute('src')).toBe('/uploads/covers/c1.webp');
 const hero = document.querySelector(`[data-theme="${THEME}"]`);
 expect(hero).toBeTruthy();
 });

 it('редактор показывает обложку и цвет темы', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: makeWishlist({
 id: 'list-1',
 coverPath: '/uploads/covers/c1.webp',
 themeColor: THEME,
 }),
 gifts: [],
 categories: [],
 },
 }),
 });

 renderApp('/app/lists/list-1');
 expect(await screen.findByRole('heading', { level: 1, name: 'День рождения' })).toBeTruthy();

 expect(screen.getByAltText('Обложка вишлиста').getAttribute('src')).toBe(
 '/uploads/covers/c1.webp',
 );
 expect(document.querySelector(`[data-theme="${THEME}"]`)).toBeTruthy();
 });
});

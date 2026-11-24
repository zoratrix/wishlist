import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import {
 makeWishlist,
 mockApi,
 renderApp,
 TEST_USER,
} from '../test/helpers';

const followerWishlist = makeWishlist({
 id: 'w1',
 title: 'Только для подписчиков',
 visibility: 'followers',
});

describe('видимость «только подписчикам»', () => {
 it('в настройках списка есть 3 варианта и сохраняется followers', async () => {
 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/w1': () => ({
 body: { wishlist: followerWishlist, gifts: [], categories: [] },
 }),
 'PATCH /api/me/wishlists/w1': (call) => ({
 body: { wishlist: { ...followerWishlist, ...(call.body as Record<string, unknown>) } },
 }),
 });

 renderApp('/app/lists/w1/settings');

 expect(await screen.findByRole('heading', { level: 1, name: 'Настройки списка' })).toBeTruthy();

 // Выбран уже followers; переключаемся на «По ссылке» и обратно, чтобы проверить сохранение.
 expect(screen.getByRole('radio', { name: /Публичный/ })).toBeTruthy();
 expect(screen.getByRole('radio', { name: /По ссылке/ })).toBeTruthy();
 expect(screen.getByRole('radio', { name: /Только подписчикам/ })).toBeTruthy();

 fireEvent.click(screen.getByRole('radio', { name: /Публичный/ }));
 fireEvent.click(screen.getByRole('radio', { name: /Только подписчикам/ }));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 expect(await screen.findByText('Настройки сохранены.')).toBeTruthy();
 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/wishlists/w1',
 );
 expect(patchCall?.body).toMatchObject({ visibility: 'followers' });
 });

 it('бейдж «Только подписчикам» на карточках и в редакторе', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [followerWishlist] } }),
 'GET /api/me/wishlists/w1': () => ({
 body: { wishlist: followerWishlist, gifts: [], categories: [] },
 }),
 });

 const lists = renderApp('/app');
 expect(await screen.findByText('Только для подписчиков')).toBeTruthy();
 expect(screen.getAllByText('Только подписчикам').length).toBeGreaterThan(0);
 lists.unmount();

 renderApp('/app/lists/w1');
 expect(await screen.findByText(/Только подписчикам/)).toBeTruthy();
 });

 it('публичная страница followers-списка: гостю — подсказка и кнопка входа', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'GET /api/w/f0ll0w': () => ({
 status: 404,
 body: { error: { code: 'NOT_FOUND', message: 'Страница не найдена или недоступна.' } },
 }),
 });

 renderApp('/w/f0ll0w');

 expect(await screen.findByText('Страница не найдена или недоступна.')).toBeTruthy();
 expect(screen.getByText('Список доступен только подписчикам')).toBeTruthy();
 expect(screen.getByText(/Войдите и подпишитесь на владельца/)).toBeTruthy();
 const loginLinks = screen.getAllByRole('link', { name: 'Войти' });
 expect(loginLinks.some((link) => link.getAttribute('href') === '/login')).toBe(true);
 });

 it('публичная страница followers-списка: авторизованному — подсказка подписаться', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/w/f0ll0w': () => ({
 status: 404,
 body: { error: { code: 'NOT_FOUND', message: 'Страница не найдена или недоступна.' } },
 }),
 });

 renderApp('/w/f0ll0w');

 expect(await screen.findByText('Список доступен только подписчикам')).toBeTruthy();
 expect(screen.getByText(/Подпишитесь на владельца/)).toBeTruthy();
 expect(screen.queryByRole('link', { name: 'Войти' })).toBeNull();
 });
});

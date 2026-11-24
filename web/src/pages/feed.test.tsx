import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { mockApi, renderApp, TEST_USER } from '../test/helpers';

const feed = {
 items: [
 {
 type: 'wishlist',
 at: '2026-11-10T09:00:00.000Z',
 wishlist: {
 id: 'w1',
 title: 'День рождения',
 shareToken: 'f0ll0w',
 owner: { username: 'bob', displayName: 'Борис', avatarPath: null },
 },
 },
 {
 type: 'birthday',
 at: '2026-11-13T09:00:00.000Z',
 date: '04-15',
 inDays: 3,
 user: { username: 'anna', displayName: 'Анна', avatarPath: null },
 },
 ],
};

describe('лента /app/feed', () => {
 it('рендерит вишлист подписки и ближайший день рождения', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/feed': () => ({ body: feed }),
 });

 renderApp('/app/feed');

 expect(await screen.findByRole('heading', { level: 1, name: 'Лента' })).toBeTruthy();
 expect(await screen.findByText('День рождения')).toBeTruthy();

 const wishlistItem = document.querySelector('[data-feed-type="wishlist"]') as HTMLElement;
 expect(wishlistItem).toBeTruthy();
 expect(wishlistItem.textContent).toContain('День рождения');
 expect(wishlistItem.textContent).toContain('Борис');
 expect(wishlistItem.getAttribute('href')).toBe('/w/f0ll0w');

 const birthdayItem = document.querySelector('[data-feed-type="birthday"]') as HTMLElement;
 expect(birthdayItem).toBeTruthy();
 expect(birthdayItem.textContent).toContain('Анна');
 expect(birthdayItem.textContent).toContain('15 апреля');
 expect(birthdayItem.textContent).toContain('через 3 дня');
 });

 it('пустая лента — подсказка подписаться', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/feed': () => ({ body: { items: [] } }),
 });

 renderApp('/app/feed');

 expect(await screen.findByText('Пока пусто')).toBeTruthy();
 expect(screen.getByText(/Подпишитесь на кого-нибудь/)).toBeTruthy();
 });

 it('ошибка загрузки — сообщение и повтор', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/feed': () => ({
 status: 500,
 body: { error: { code: 'INTERNAL', message: 'Сервер не смог выполнить запрос.' } },
 }),
 });

 renderApp('/app/feed');

 expect(await screen.findByText('Сервер не смог выполнить запрос.')).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
 });
});

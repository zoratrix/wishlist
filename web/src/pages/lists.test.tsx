import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { makeWishlist, mockApi, renderApp, TEST_USER } from '../test/helpers';

describe('списки в профиле', () => {
 it('показывает карточки списков с числом подарков и доступом', async () => {
 const wishlist = makeWishlist({
 id: 'list-1',
 title: 'День рождения',
 giftCount: 3,
 visibility: 'public',
 eventDate: '2026-12-20',
 });

 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [wishlist] } }),
 });

 renderApp('/app/profile');

 expect(await screen.findByText('День рождения')).toBeTruthy();
 expect(screen.getByText(/3 подарка/)).toBeTruthy();
 expect(screen.getByText('Публичный')).toBeTruthy();
 expect(screen.getByRole('link', { name: 'Редактировать' }).getAttribute('href')).toBe(
 '/app/lists/list-1',
 );
 });

 it('создаёт новый список из профиля и открывает его редактор', async () => {
 const created = makeWishlist({ id: 'list-2', title: 'Новый год', giftCount: 0 });

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 'POST /api/me/wishlists': () => ({ status: 201, body: { wishlist: created } }),
 'GET /api/me/wishlists/list-2': () => ({ body: { wishlist: created, gifts: [] } }),
 });

 renderApp('/app/profile');

 fireEvent.click(await screen.findByRole('button', { name: '＋ Новый список' }));

 const dialog = await screen.findByRole('dialog');
 fireEvent.change(within(dialog).getByLabelText('Название'), {
 target: { value: 'Новый год' },
 });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Создать список' }));

 expect(await screen.findByRole('heading', { level: 1, name: 'Новый год' })).toBeTruthy();
 expect(await screen.findByText('Пока нет подарков')).toBeTruthy();

 const createCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists',
 );
 expect(createCall?.body).toEqual({ title: 'Новый год', eventDate: null, visibility: 'link' });
 });
});

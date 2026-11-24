import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { UserSelfDTO } from '../lib/types';
import { makeWishlist, mockApi, renderApp, TEST_USER } from '../test/helpers';

describe('настройки профиля', () => {
 it('сохраняет профиль через PATCH /api/me/profile', async () => {
 let currentUser: UserSelfDTO = TEST_USER;

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: currentUser } }),
 'PATCH /api/me/profile': (call) => {
 const patch = call.body as Partial<UserSelfDTO>;
 currentUser = { ...currentUser, ...patch };
 return { body: { user: currentUser } };
 },
 });

 renderApp('/app/profile/edit');

 expect(
 await screen.findByRole('heading', { level: 1, name: 'Редактирование профиля' }),
 ).toBeTruthy();
 expect(screen.getByText('anna@example.com')).toBeTruthy();

 fireEvent.change(screen.getByLabelText('Имя'), { target: { value: 'Анна П.' } });
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить профиль' }));

 expect(await screen.findByText('Профиль сохранён.')).toBeTruthy();

 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/profile',
 );
 expect(patchCall?.body).toEqual({
 displayName: 'Анна П.',
 bio: null,
 birthMonth: 4,
 birthDay: 15,
 birthYear: 1992,
 showBirthYear: true,
 isProfilePublic: true,
 });
 });
});

describe('настройки списка', () => {
 it('сохраняет переключатели броней и видимость', async () => {
 const wishlist = makeWishlist({
 id: 'list-1',
 visibility: 'link',
 showBooked: false,
 showBookerNames: false,
 });

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({ body: { wishlist, gifts: [] } }),
 'PATCH /api/me/wishlists/list-1': () => ({ body: { wishlist } }),
 });

 renderApp('/app/lists/list-1/settings');

 expect(await screen.findByRole('heading', { level: 1, name: 'Настройки списка' })).toBeTruthy();

 fireEvent.click(screen.getByLabelText('Показывать забронированные подарки'));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

 expect(await screen.findByText('Настройки сохранены.')).toBeTruthy();

 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/wishlists/list-1',
 );
 expect(patchCall?.body).toEqual({
 title: 'День рождения',
 description: null,
 eventDate: '2026-12-20',
 visibility: 'link',
 themeColor: null,
 themeEmoji: null,
 showBooked: true,
 showBookerNames: false,
 });
 });

 it('удаляет список после подтверждения', async () => {
 const wishlist = makeWishlist({ id: 'list-1' });

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({ body: { wishlist, gifts: [] } }),
 'DELETE /api/me/wishlists/list-1': () => ({ status: 204 }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 });

 renderApp('/app/lists/list-1/settings');
 await screen.findByRole('heading', { level: 1, name: 'Настройки списка' });

 fireEvent.click(screen.getByRole('button', { name: 'Удалить список' }));

 const dialog = await screen.findByRole('dialog');
 fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();
 expect(
 calls.some((call) => call.method === 'DELETE' && call.path === '/api/me/wishlists/list-1'),
 ).toBe(true);
 });
});

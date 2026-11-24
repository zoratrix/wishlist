import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { FollowUserDTO } from '../lib/types';
import { mockApi, renderApp, TEST_USER } from '../test/helpers';

const anna: FollowUserDTO = {
 id: 'u1',
 username: 'anna',
 displayName: 'Анна',
 bio: 'Люблю подарки',
 avatarPath: null,
 followedAt: '2026-11-13T10:00:00.000Z',
};

const boris: FollowUserDTO = {
 id: 'u2',
 username: 'boris',
 displayName: 'Борис',
 bio: null,
 avatarPath: null,
 followedAt: '2026-11-13T11:00:00.000Z',
};

describe('мои подписчики', () => {
 it('рендерит список и позволяет удалить подписчика', async () => {
 let users = [anna, boris];

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/followers': () => ({ body: { users, total: users.length } }),
 'DELETE /api/me/followers/u2': () => {
 users = users.filter((user) => user.id !== 'u2');
 return { status: 204 };
 },
 });

 renderApp('/app/followers');

 expect(await screen.findByRole('heading', { level: 1, name: 'Мои подписчики' })).toBeTruthy();
 expect(await screen.findByText('Борис')).toBeTruthy();
 const annaLink = screen
 .getAllByRole('link', { name: 'Анна' })
 .find((link) => link.getAttribute('href') === '/u/anna');
 expect(annaLink).toBeTruthy();
 expect(screen.getByText('@boris')).toBeTruthy();

 fireEvent.click(screen.getAllByRole('button', { name: 'Удалить подписчика' })[1] as HTMLElement);
 const dialog = await screen.findByRole('dialog');
 expect(within(dialog).getByText(/больше не будет видеть списки/)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить подписчика' }));

 expect(await screen.findByText('Готово: Борис.')).toBeTruthy();
 expect(
 calls.some((call) => call.method === 'DELETE' && call.path === '/api/me/followers/u2'),
 ).toBe(true);
 });

 it('пустое состояние и счётчик 0', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/followers': () => ({ body: { users: [], total: 0 } }),
 });

 renderApp('/app/followers');

 expect(await screen.findByText('Пока нет подписчиков')).toBeTruthy();
 expect(screen.getByText('0')).toBeTruthy();
 });
});

describe('мои подписки', () => {
 it('рендерит список и позволяет отписаться', async () => {
 let users = [anna, boris];

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/following': () => ({ body: { users, total: users.length } }),
 'DELETE /api/users/anna/follow': () => {
 users = users.filter((user) => user.username !== 'anna');
 return { body: { isFollowing: false } };
 },
 });

 renderApp('/app/following');

 expect(await screen.findByRole('heading', { level: 1, name: 'Мои подписки' })).toBeTruthy();
 expect(await screen.findByText('Борис')).toBeTruthy();
 const annaLink = screen
 .getAllByRole('link', { name: 'Анна' })
 .find((link) => link.getAttribute('href') === '/u/anna');
 expect(annaLink).toBeTruthy();

 fireEvent.click(screen.getAllByRole('button', { name: 'Отписаться' })[0] as HTMLElement);
 const dialog = await screen.findByRole('dialog');
 expect(within(dialog).getByText(/Перестать следить/)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button', { name: 'Отписаться' }));

 expect(await screen.findByText('Готово: Анна.')).toBeTruthy();
 expect(
 calls.some((call) => call.method === 'DELETE' && call.path === '/api/users/anna/follow'),
 ).toBe(true);
 });

 it('пустое состояние', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/following': () => ({ body: { users: [], total: 0 } }),
 });

 renderApp('/app/following');

 expect(await screen.findByText('Пока нет подписок')).toBeTruthy();
 });
});

describe('навигация и профиль', () => {
 it('в навигации есть «Подписки», в профиле — ссылки и счётчики', async () => {
 mockApi({
 'GET /api/auth/me': () => ({
 body: { user: { ...TEST_USER, followersCount: 5, followingCount: 4 } },
 }),
 });

 renderApp('/app/profile');

 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();
 expect(
 screen.getByRole('link', { name: 'Редактировать профиль' }).getAttribute('href'),
 ).toBe('/app/profile/edit');
 expect(screen.getByRole('link', { name: 'Подписчики: 5' }).getAttribute('href')).toBe(
 '/app/followers',
 );
 expect(screen.getByRole('link', { name: 'Подписки: 4' }).getAttribute('href')).toBe(
 '/app/following',
 );
 expect(
 screen.getByRole('heading', { level: 2, name: 'Мои вишлисты' }),
 ).toBeTruthy();
 // В навигации тоже есть «Подписки».
 expect(screen.getAllByRole('link', { name: 'Подписки' }).length).toBeGreaterThan(0);
 });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { UserPublicDTO } from '../lib/types';
import {
 makeWishlist,
 mockApi,
 renderApp,
 TEST_USER,
} from '../test/helpers';

const bob: UserPublicDTO = {
 id: 'u2',
 username: 'bob',
 displayName: 'Борис',
 bio: 'Люблю книги',
 avatarPath: null,
 birthMonth: 4,
 birthDay: 15,
 birthYear: 1992,
 showBirthYear: true,
 isProfilePublic: true,
 createdAt: '2026-11-12T09:00:00.000Z',
};

const bobWishlists = [
 makeWishlist({ id: 'w1', title: 'День рождения', giftCount: 3 }),
 makeWishlist({
 id: 'w2',
 title: 'Новый год',
 visibility: 'followers',
 shareToken: 'f0ll0w',
 giftCount: 1,
 }),
];

describe('публичный профиль /u/:username', () => {
 it('рендерит профиль, вишлисты и подписку: POST → «Вы подписаны» → DELETE', async () => {
 let isFollowing = false;

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/users/bob': () => ({
 body: {
 user: bob,
 wishlists: bobWishlists,
 viewer: { isSelf: false, isFollowing, canFollow: true },
 },
 }),
 'POST /api/users/bob/follow': () => {
 isFollowing = true;
 return { body: { isFollowing: true } };
 },
 'DELETE /api/users/bob/follow': () => {
 isFollowing = false;
 return { body: { isFollowing: false } };
 },
 });

 renderApp('/u/bob');

 expect(await screen.findByRole('heading', { level: 1, name: 'Борис' })).toBeTruthy();
 expect(screen.getByText('@bob')).toBeTruthy();
 expect(screen.getByText('Люблю книги')).toBeTruthy();
 expect(screen.getByText('День рождения')).toBeTruthy();
 expect(screen.getByText('Только подписчикам')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Подписаться' }));
 expect(await screen.findByRole('button', { name: 'Вы подписаны' })).toBeTruthy();
 expect(
 calls.some((call) => call.method === 'POST' && call.path === '/api/users/bob/follow'),
 ).toBe(true);

 fireEvent.click(screen.getByRole('button', { name: 'Вы подписаны' }));
 expect(await screen.findByRole('button', { name: 'Подписаться' })).toBeTruthy();
 expect(
 calls.some((call) => call.method === 'DELETE' && call.path === '/api/users/bob/follow'),
 ).toBe(true);
 });

 it('свой профиль: «Редактировать профиль» и счётчики', async () => {
 mockApi({
 'GET /api/auth/me': () => ({
 body: { user: { ...TEST_USER, followersCount: 3, followingCount: 2 } },
 }),
 'GET /api/users/anna': () => ({
 body: {
 user: {
 ...bob,
 id: TEST_USER.id,
 username: 'anna',
 displayName: 'Анна',
 bio: null,
 },
 wishlists: [],
 viewer: { isSelf: true, isFollowing: false, canFollow: false },
 },
 }),
 });

 renderApp('/u/anna');
 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();

 const edit = screen.getByRole('link', { name: 'Редактировать профиль' });
 expect(edit.getAttribute('href')).toBe('/app/profile/edit');
 expect(screen.getByRole('link', { name: 'Подписчики: 3' }).getAttribute('href')).toBe(
 '/app/followers',
 );
 expect(screen.getByRole('link', { name: 'Подписки: 2' }).getAttribute('href')).toBe(
 '/app/following',
 );
 // Кнопки подписки на себя нет.
 expect(screen.queryByRole('button', { name: 'Подписаться' })).toBeNull();
 });

 it('закрытый профиль (404) → «Профиль недоступен»', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/users/secret': () => ({
 status: 404,
 body: { error: { code: 'NOT_FOUND', message: 'Страница не найдена или недоступна.' } },
 }),
 });

 renderApp('/u/secret');

 expect(await screen.findByText('Профиль недоступен')).toBeTruthy();
 });

 it('гостю кнопка подписки ведёт на /login с возвратом на профиль', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'GET /api/users/bob': () => ({
 body: {
 user: bob,
 wishlists: [],
 viewer: { isSelf: false, isFollowing: false, canFollow: false },
 },
 }),
 });

 renderApp('/u/bob');
 await screen.findByRole('heading', { level: 1, name: 'Борис' });

 const follow = screen.getByRole('link', { name: 'Подписаться' });
 expect(follow.getAttribute('href')).toBe('/login');
 expect(screen.getByRole('link', { name: 'Войти' }).getAttribute('href')).toBe('/login');
 });
});

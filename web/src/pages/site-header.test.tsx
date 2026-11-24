import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { makeGift, makePublicWishlist, mockApi, renderApp, TEST_USER } from '../test/helpers';

describe('единый хедер', () => {
 it('на публичном профиле: 3 пункта меню, аватар и имя, нижние вкладки', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/users/bob': () => ({
 body: {
 user: {
 id: 'u2',
 username: 'bob',
 displayName: 'Борис',
 bio: null,
 avatarPath: null,
 birthMonth: null,
 birthDay: null,
 birthYear: null,
 showBirthYear: false,
 isProfilePublic: true,
 createdAt: '2026-11-12T09:00:00.000Z',
 },
 wishlists: [],
 viewer: { isSelf: false, isFollowing: false, canFollow: true },
 },
 }),
 });

 renderApp('/u/bob');
 await screen.findByRole('heading', { level: 1, name: 'Борис' });

 const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
 for (const label of ['Лента', 'Подписки', 'Профиль']) {
 expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
 }
 // Имя в шапке.
 expect(screen.getAllByText('Анна').length).toBeGreaterThan(0);

 const tabs = screen.getByRole('navigation', { name: 'Нижняя навигация' });
 for (const label of ['Лента', 'Подписки', 'Профиль']) {
 expect(within(tabs).getByRole('link', { name: label })).toBeTruthy();
 }
 });

 it('на публичной странице вишлиста у вошедшего — те же 3 пункта', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist(),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
 for (const label of ['Лента', 'Подписки', 'Профиль']) {
 expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
 }
 });

 it('на публичной странице вишлиста: у гостя «Лента»/«Войти» и нет нижних вкладок', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist(),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 const nav = screen.getByRole('navigation', { name: 'Гостевая навигация' });
 expect(within(nav).getByRole('link', { name: 'Лента' })).toBeTruthy();
 expect(within(nav).getByRole('link', { name: 'Войти' }).getAttribute('href')).toBe('/login');
 expect(screen.queryByRole('navigation', { name: 'Нижняя навигация' })).toBeNull();
 });
});

import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import {
 GUEST_VIEWER,
 makeGift,
 makePublicWishlist,
 mockApi,
 renderApp,
 TEST_USER,
} from '../test/helpers';

const AUTHED_LABELS = ['Лента', 'Подписки', 'Профиль'] as const;

function expectThreeSectionLinks(nav: HTMLElement) {
 for (const label of AUTHED_LABELS) {
  expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
 }
}

describe('единый хедер', () => {
 it('на публичном профиле: 3 пункта меню, аватар и имя, меню в шапке', async () => {
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

  // Десктопное меню в первой строке шапки.
  const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
  expectThreeSectionLinks(nav);

  // Имя в шапке.
  expect(screen.getAllByText('Анна').length).toBeGreaterThan(0);

  // Мобильное меню — вторая строка шапки, те же 3 пункта.
  const sections = screen.getByRole('navigation', { name: 'Разделы' });
  expectThreeSectionLinks(sections);

  // Нижней фиксированной панели больше нет.
  expect(screen.queryByRole('navigation', { name: 'Нижняя навигация' })).toBeNull();
 });

 it('на публичной странице вишлиста у вошедшего — те же 3 пункта', async () => {
  mockApi({
   'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
   'GET /api/w/token-1': () => ({
    body: {
     viewer: GUEST_VIEWER,
     wishlist: makePublicWishlist(),
     gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
     categories: [],
    },
   }),
  });

  renderApp('/w/token-1');
  await screen.findByText('Наушники');

  const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
  expectThreeSectionLinks(nav);

  const sections = screen.getByRole('navigation', { name: 'Разделы' });
  expectThreeSectionLinks(sections);
  expect(screen.queryByRole('navigation', { name: 'Нижняя навигация' })).toBeNull();
 });

 it('активный пункт мобильного меню подсвечен как вкладка', async () => {
  mockApi({
   'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
   'GET /api/me/feed': () => ({ body: { items: [] } }),
  });

  renderApp('/app/feed');
  await screen.findByText('Пока пусто');

  const sections = screen.getByRole('navigation', { name: 'Разделы' });
  const feedLink = within(sections).getByRole('link', { name: 'Лента' });
  expect(feedLink.getAttribute('aria-current')).toBe('page');
  expect(feedLink.className).toContain('bg-accent-soft');
  expect(feedLink.className).toContain('min-h-11');

  const followingLink = within(sections).getByRole('link', { name: 'Подписки' });
  expect(followingLink.getAttribute('aria-current')).toBeNull();
  expect(followingLink.className).not.toContain('bg-accent-soft');
 });

 it('на публичной странице вишлиста: у гостя «Лента»/«Войти» и нет мобильного меню', async () => {
  mockApi({
   'GET /api/auth/me': () => ({ body: { user: null } }),
   'GET /api/w/token-1': () => ({
    body: {
     viewer: GUEST_VIEWER,
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

  expect(screen.queryByRole('navigation', { name: 'Разделы' })).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Нижняя навигация' })).toBeNull();
 });
});

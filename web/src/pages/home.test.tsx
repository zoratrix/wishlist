import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { mockApi, renderApp, TEST_USER } from '../test/helpers';

describe('лендинг', () => {
 it('гостю показывает hero, CTA, баннер и шаги', async () => {
 mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/');

 expect(await screen.findByRole('heading', { level: 1, name: /Списки желаний/ })).toBeTruthy();

 // Две CTA: «Создать список» → /register, «Войти» → /login (в шапке тоже есть вход).
 const create = screen.getAllByRole('link', { name: 'Создать список' });
 expect(create.length).toBeGreaterThan(0);
 for (const link of create) {
 expect(link.getAttribute('href')).toBe('/register');
 }

 const login = screen.getAllByRole('link', { name: 'Войти' });
 expect(login.length).toBeGreaterThan(0);
 for (const link of login) {
 expect(link.getAttribute('href')).toBe('/login');
 }

 // Баннер про гостей и мокап вишлиста со статусами подарков.
 expect(screen.getByText(/Гости бронируют подарки без регистрации/)).toBeTruthy();
 expect(screen.getByText('Забронирован')).toBeTruthy();
 expect(screen.getAllByText('Свободен').length).toBeGreaterThan(0);

 // Три шага «Как это работает».
 expect(screen.getByRole('heading', { level: 2, name: 'Как это работает' })).toBeTruthy();
 expect(screen.getByText('Соберите список')).toBeTruthy();
 expect(screen.getByText('Отправьте ссылку')).toBeTruthy();
 expect(screen.getByText('Получайте подарки')).toBeTruthy();
 });

 it('вошедшего пользователя отправляет в приложение', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 });

 renderApp('/');

 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();
 });

 it('на неизвестный адрес показывает страницу 404', async () => {
 mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/no-such-page');

 expect(await screen.findByText('Страница не найдена')).toBeTruthy();
 });
});

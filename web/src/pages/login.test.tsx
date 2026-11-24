import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { UserSelfDTO } from '../lib/types';
import { mockApi, renderApp, TEST_USER } from '../test/helpers';

function fillLoginForm(email = 'anna@example.com', password = 'test12345') {
 fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
 fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
 fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
}

describe('страница входа', () => {
 it('рендерит форму, отправляет данные и показывает ошибку 401', async () => {
 document.cookie = 'csrf=csrf-test-token; path=/';

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: null } }),
 'POST /api/auth/login': () => ({
 status: 401,
 body: {
 error: { code: 'INVALID_CREDENTIALS', message: 'Неверный email или пароль.' },
 },
 }),
 });

 renderApp('/login');

 expect(await screen.findByRole('heading', { name: 'Вход' })).toBeTruthy();
 fillLoginForm();

 expect(await screen.findByText('Неверный email или пароль.')).toBeTruthy();

 const loginCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/auth/login',
 );
 expect(loginCall?.body).toEqual({ email: 'anna@example.com', password: 'test12345' });
 expect(loginCall?.headers['X-CSRF-Token']).toBe('csrf-test-token');
 });

 it('показывает ошибку, если поля пустые', async () => {
 mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/login');
 fireEvent.click(await screen.findByRole('button', { name: 'Войти' }));

 expect(await screen.findByText('Введите email и пароль.')).toBeTruthy();
 });

 it('после успешного входа открывает «Мои вишлисты»', async () => {
 let currentUser: UserSelfDTO | null = null;

 mockApi({
 'GET /api/auth/me': () => ({ body: { user: currentUser } }),
 'POST /api/auth/login': () => {
 currentUser = TEST_USER;
 return { body: { user: TEST_USER } };
 },
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 });

 renderApp('/login');
 fillLoginForm();

 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();
 expect(await screen.findByText(/Пока нет списков/)).toBeTruthy();
 });

 it('показывает ссылку «Забыли пароль?» на восстановление', async () => {
 mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/login');
 const link = await screen.findByRole('link', { name: 'Забыли пароль?' });
 expect(link.getAttribute('href')).toBe('/forgot-password');
 });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { UserSelfDTO } from '../lib/types';
import { mockApi, renderApp, TEST_USER } from '../test/helpers';

function fillRegisterForm({
 email = 'petr@example.com',
 password = 'test12345',
 name = 'Пётр',
 username = 'petr',
} = {}) {
 fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
 fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
 fireEvent.change(screen.getByLabelText('Имя'), { target: { value: name } });
 fireEvent.change(screen.getByLabelText('Логин'), { target: { value: username } });
}

describe('страница регистрации', () => {
 it('проверяет поля до отправки на сервер', async () => {
 const { calls } = mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/register');
 expect(await screen.findByRole('heading', { name: 'Регистрация' })).toBeTruthy();

 fillRegisterForm({ password: '123', username: 'П' });
 fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

 expect(await screen.findByText('Пароль должен быть не короче 8 символов.')).toBeTruthy();
 expect(calls.some((call) => call.method === 'POST')).toBe(false);
 });

 it('после успешной регистрации открывает «Мои вишлисты»', async () => {
 let currentUser: UserSelfDTO | null = null;

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: currentUser } }),
 'POST /api/auth/register': () => {
 currentUser = TEST_USER;
 return { status: 201, body: { user: TEST_USER } };
 },
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 });

 renderApp('/register');
 await screen.findByRole('heading', { name: 'Регистрация' });

 fillRegisterForm();
 fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();

 const registerCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/auth/register',
 );
 expect(registerCall?.body).toEqual({
 email: 'petr@example.com',
 password: 'test12345',
 displayName: 'Пётр',
 username: 'petr',
 emailNotifications: true,
 });
 });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { mockApi, renderApp } from '../test/helpers';

const INVALID_TOKEN_TEXT = 'Ссылка недействительна или устарела. Запросите новую.';

function meAsGuest() {
  return { body: { user: null } };
}

function fillPasswords(password: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText('Новый пароль'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Повторите пароль'), {
    target: { value: confirmPassword },
  });
}

describe('страница сброса пароля', () => {
  it('без токена в query показывает недействительную ссылку и не рисует форму', async () => {
    const { calls } = mockApi({ 'GET /api/auth/me': meAsGuest });

    renderApp('/reset-password');

    expect(await screen.findByText(INVALID_TOKEN_TEXT)).toBeTruthy();
    expect(screen.queryByLabelText('Новый пароль')).toBeNull();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('не отправляет запрос, если пароли не совпадают', async () => {
    const { calls } = mockApi({ 'GET /api/auth/me': meAsGuest });

    renderApp('/reset-password?token=tok-123');
    await screen.findByRole('heading', { name: 'Сброс пароля' });

    fillPasswords('newpass123', 'newpass124');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(await screen.findByText('Пароли не совпадают.')).toBeTruthy();
    expect(
      calls.some(
        (call) => call.method === 'POST' && call.path === '/api/auth/reset-password',
      ),
    ).toBe(false);
  });

  it('отправляет токен и новый пароль, показывает «Пароль изменён»', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': meAsGuest,
      'POST /api/auth/reset-password': () => ({ status: 204 }),
    });

    renderApp('/reset-password?token=tok-123');
    await screen.findByRole('heading', { name: 'Сброс пароля' });

    fillPasswords('newpass123', 'newpass123');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(await screen.findByText('Пароль изменён')).toBeTruthy();

    const resetCall = calls.find(
      (call) => call.method === 'POST' && call.path === '/api/auth/reset-password',
    );
    expect(resetCall?.body).toEqual({ token: 'tok-123', password: 'newpass123' });
  });

  it('показывает понятное сообщение для INVALID_RESET_TOKEN', async () => {
    mockApi({
      'GET /api/auth/me': meAsGuest,
      'POST /api/auth/reset-password': () => ({
        status: 400,
        body: {
          error: { code: 'INVALID_RESET_TOKEN', message: 'Токен недействителен.' },
        },
      }),
    });

    renderApp('/reset-password?token=expired-token');
    await screen.findByRole('heading', { name: 'Сброс пароля' });

    fillPasswords('newpass123', 'newpass123');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(await screen.findByText(INVALID_TOKEN_TEXT)).toBeTruthy();
  });
});

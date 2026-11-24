import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { mockApi, renderApp } from '../test/helpers';

const SUCCESS_TEXT = 'Если такой email есть, мы отправили ссылку. Проверьте почту.';

function meAsGuest() {
  return { body: { user: null } };
}

async function submitEmail(email = 'anna@example.com') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
}

describe('страница восстановления пароля', () => {
  it('отправляет email и показывает нейтральный ответ об успехе', async () => {
    const { calls } = mockApi({
      'GET /api/auth/me': meAsGuest,
      'POST /api/auth/forgot-password': () => ({ body: { ok: true } }),
    });

    renderApp('/forgot-password');
    expect(
      await screen.findByRole('heading', { name: 'Восстановление пароля' }),
    ).toBeTruthy();

    await submitEmail();

    expect(await screen.findByText(SUCCESS_TEXT)).toBeTruthy();

    const forgotCall = calls.find(
      (call) => call.method === 'POST' && call.path === '/api/auth/forgot-password',
    );
    expect(forgotCall?.body).toEqual({ email: 'anna@example.com' });
  });

  it('показывает debug-ссылку сброса, если сервер вернул debugUrl', async () => {
    const debugUrl = 'http://localhost:3000/reset-password?token=debug-token';

    mockApi({
      'GET /api/auth/me': meAsGuest,
      'POST /api/auth/forgot-password': () => ({ body: { ok: true, debugUrl } }),
    });

    renderApp('/forgot-password');
    await screen.findByRole('heading', { name: 'Восстановление пароля' });
    await submitEmail();

    expect(await screen.findByText('Локальный режим')).toBeTruthy();
    const debugLink = await screen.findByRole('link', { name: 'открыть ссылку сброса' });
    expect(debugLink.getAttribute('href')).toBe(debugUrl);
  });

  it('показывает ошибку сети', async () => {
    mockApi({
      'GET /api/auth/me': meAsGuest,
      'POST /api/auth/forgot-password': () => {
        throw new Error('offline');
      },
    });

    renderApp('/forgot-password');
    await screen.findByRole('heading', { name: 'Восстановление пароля' });
    await submitEmail();

    expect(await screen.findByText(/Не удалось связаться с сервером/)).toBeTruthy();
  });

  it('показывает ошибку лимита попыток (429)', async () => {
    mockApi({
      'GET /api/auth/me': meAsGuest,
      'POST /api/auth/forgot-password': () => ({
        status: 429,
        body: {
          error: { code: 'RATE_LIMITED', message: 'Слишком много попыток. Попробуйте позже.' },
        },
      }),
    });

    renderApp('/forgot-password');
    await screen.findByRole('heading', { name: 'Восстановление пароля' });
    await submitEmail();

    expect(await screen.findByText('Слишком много попыток. Попробуйте позже.')).toBeTruthy();
  });
});

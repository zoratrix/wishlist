import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { mockApi, renderApp } from '../test/helpers';

describe('защита приложения', () => {
 it('неавторизованного отправляет на страницу входа', async () => {
 mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/app');

 expect(await screen.findByRole('heading', { name: 'Вход' })).toBeTruthy();
 });

 it('неавторизованному не показывает редактор списка', async () => {
 mockApi({ 'GET /api/auth/me': () => ({ body: { user: null } }) });

 renderApp('/app/lists/list-1');

 expect(await screen.findByRole('heading', { name: 'Вход' })).toBeTruthy();
 expect(screen.queryByText('Подарки')).toBeNull();
 });
});

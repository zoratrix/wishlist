import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { UserSelfDTO } from '../lib/types';
import { mockApi, renderApp, TEST_USER } from '../test/helpers';

beforeEach(() => {
 URL.createObjectURL = vi.fn(() => 'blob:avatar-preview') as unknown as typeof URL.createObjectURL;
 URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
});

describe('профиль в аккаунте', () => {
 it('/app/profile показывает счётчики, редактирование и ссылки', async () => {
 mockApi({
 'GET /api/auth/me': () => ({
 body: { user: { ...TEST_USER, followersCount: 7, followingCount: 3 } },
 }),
 'GET /api/me/wishlists': () => ({ body: { wishlists: [] } }),
 });

 renderApp('/app/profile');

 expect(await screen.findByRole('heading', { level: 1, name: 'Анна' })).toBeTruthy();
 expect(screen.getByText('@anna')).toBeTruthy();
 expect(screen.getByRole('link', { name: 'Подписчики: 7' })).toBeTruthy();
 expect(screen.getByRole('link', { name: 'Подписки: 3' })).toBeTruthy();
 expect(
 screen.getByRole('link', { name: 'Редактировать профиль' }).getAttribute('href'),
 ).toBe('/app/profile/edit');
 expect(
 screen.getByRole('heading', { level: 2, name: 'Мои вишлисты' }),
 ).toBeTruthy();
 });

 it('старый /app/settings редиректит на /app/profile/edit', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 });

 renderApp('/app/settings');

 expect(
 await screen.findByRole('heading', { level: 1, name: 'Редактирование профиля' }),
 ).toBeTruthy();
 expect(screen.getByLabelText('Имя')).toBeTruthy();
 });
});

describe('загрузка аватара', () => {
 it('отправляет multipart на /api/me/avatar и обновляет превью и шапку', async () => {
 const uploadedUser: UserSelfDTO = { ...TEST_USER, avatarPath: '/uploads/avatars/a1.webp' };
 let currentUser: UserSelfDTO = TEST_USER;

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: currentUser } }),
 'POST /api/me/avatar': () => {
 currentUser = uploadedUser;
 return { body: { user: uploadedUser } };
 },
 });

 renderApp('/app/profile/edit');
 await screen.findByRole('heading', { level: 1, name: 'Редактирование профиля' });

 const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });
 fireEvent.change(screen.getByLabelText('Файл аватара'), { target: { files: [file] } });

 expect(await screen.findByText('Аватар обновлён.')).toBeTruthy();

 const uploadCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/avatar',
 );
 expect(uploadCall?.body).toBeInstanceOf(FormData);
 const formData = uploadCall?.body as FormData;
 expect(formData.get('file')).toBeInstanceOf(File);
 expect((formData.get('file') as File).name).toBe('avatar.png');
 expect(URL.createObjectURL).toHaveBeenCalled();

 // Локальное превью и аватар в шапке (после обновления me).
 expect(screen.getByAltText('Предпросмотр аватара').getAttribute('src')).toBe(
 'blob:avatar-preview',
 );
 await waitFor(() => {
 expect(document.querySelector('img[src="/uploads/avatars/a1.webp"]')).toBeTruthy();
 });
 });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { makeCategory, makeGift, makeWishlist, mockApi, mockEditorGifts, renderApp, TEST_USER } from '../test/helpers';

const electronics = makeCategory('c1', 'Электроника');
const books = makeCategory('c2', 'Книги');

describe('управление категориями в редакторе', () => {
 it('добавляет категорию через «＋ Категория» (POST)', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], [electronics]);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: '＋ Категория' }));
 const input = await screen.findByLabelText('Название новой категории списка');
 fireEvent.change(input, { target: { value: 'Игрушки' } });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByRole('button', { name: 'Игрушки' })).toBeTruthy();
 const createCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/categories',
 );
 expect(createCall?.body).toEqual({ name: 'Игрушки', color: null });
 });

 it('переименовывает категорию в режиме «Изменить» (PATCH)', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], [electronics]);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
 fireEvent.click(screen.getByRole('button', { name: 'Переименовать категорию «Электроника»' }));

 const input = screen.getByLabelText('Новое название категории «Электроника»');
 fireEvent.change(input, { target: { value: 'Гаджеты' } });
 fireEvent.keyDown(input, { key: 'Enter' });

 expect(await screen.findByRole('button', { name: 'Гаджеты' })).toBeTruthy();
 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/categories/c1',
 );
 expect(patchCall?.body).toEqual({ name: 'Гаджеты' });
 });

 it('удаляет категорию с подтверждением «подарки останутся, теги снимутся» (DELETE)', async () => {
 const { calls } = mockEditorGifts(
 [makeGift({ id: 'g1', title: 'Наушники', categories: [electronics] })],
 [electronics],
 );

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
 fireEvent.click(screen.getByRole('button', { name: 'Удалить категорию «Электроника»' }));

 const dialog = await screen.findByRole('dialog');
 expect(within(dialog).getByText(/подарки останутся, теги снимутся/)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

 expect(await screen.findByText('Категория удалена. Подарки остались, теги сняты.')).toBeTruthy();
 expect(screen.queryByRole('button', { name: 'Электроника' })).toBeNull();
 expect(
 calls.some((call) => call.method === 'DELETE' && call.path === '/api/me/categories/c1'),
 ).toBe(true);
 });

 it('без категорий показывает «＋ Категория» и подсказку, без фильтра', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], []);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 expect(screen.getByRole('button', { name: '＋ Категория' })).toBeTruthy();
 expect(screen.getByText('Добавьте категории, чтобы группировать подарки.')).toBeTruthy();
 expect(screen.queryByRole('group', { name: 'Фильтр по категориям' })).toBeNull();
 expect(screen.queryByRole('button', { name: 'Изменить' })).toBeNull();
 });

 it('на странице настроек блока «Категории списка» больше нет', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: { ...makeWishlist({ id: 'list-1' }), giftCount: 0 },
 gifts: [],
 categories: [electronics],
 },
 }),
 });

 renderApp('/app/lists/list-1/settings');
 expect(await screen.findByRole('heading', { name: 'Настройки списка' })).toBeTruthy();

 expect(screen.queryByText('Категории списка')).toBeNull();
 expect(screen.queryByLabelText('Название новой категории списка')).toBeNull();
 expect(screen.queryByRole('button', { name: 'Добавить категорию' })).toBeNull();
 });
});

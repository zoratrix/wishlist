import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
 makeGift,
 makeWishlist,
 mockApi,
 mockEditorGifts,
 renderApp,
 stubWideScreen,
 TEST_USER,
} from '../test/helpers';

function patchCall(calls: ReturnType<typeof mockEditorGifts>['calls']) {
 return calls.find((call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1');
}

describe('правка прямо в ячейках таблицы', () => {
 it('название: клик по значению → Enter — PATCH только названия', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Наушники' }));

 const input = screen.getByRole('textbox', { name: 'Название подарка' });
 fireEvent.change(input, { target: { value: 'Беспроводные наушники' } });
 fireEvent.keyDown(input, { key: 'Enter' });

 expect(await screen.findByText('Беспроводные наушники')).toBeTruthy();
 expect(patchCall(calls)?.body).toEqual({ title: 'Беспроводные наушники' });
 });

 it('blur (уход из поля) тоже сохраняет правку', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Наушники' }));
 const input = screen.getByRole('textbox', { name: 'Название подарка' });
 fireEvent.change(input, { target: { value: 'Наушники с шумоподавлением' } });
 fireEvent.blur(input);

 expect(await screen.findByText('Наушники с шумоподавлением')).toBeTruthy();
 expect(patchCall(calls)?.body).toEqual({ title: 'Наушники с шумоподавлением' });
 });

 it('Esc отменяет правку без запроса', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Наушники' }));
 const input = screen.getByRole('textbox', { name: 'Название подарка' });
 fireEvent.change(input, { target: { value: 'Другое название' } });
 fireEvent.keyDown(input, { key: 'Escape' });

 expect(screen.getByText('Наушники')).toBeTruthy();
 expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
 });

 it('пустое название откатывается и показывает сообщение', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Наушники' }));
 const input = screen.getByRole('textbox', { name: 'Название подарка' });
 fireEvent.change(input, { target: { value: ' ' } });
 fireEvent.keyDown(input, { key: 'Enter' });

 expect(await screen.findByText('Название не может быть пустым.')).toBeTruthy();
 expect(screen.getByText('Наушники')).toBeTruthy();
 expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
 });

 it('ошибка сохранения показывается в ячейке, введённое не теряется', async () => {
 stubWideScreen();
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: makeWishlist({ id: 'list-1' }),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 },
 }),
 'PATCH /api/me/gifts/g1': () => ({
 status: 500,
 body: { error: { code: 'INTERNAL', message: 'Сервер не смог выполнить запрос.' } },
 }),
 });

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Наушники' }));
 const input = screen.getByRole('textbox', { name: 'Название подарка' });
 fireEvent.change(input, { target: { value: 'Новое название' } });
 fireEvent.keyDown(input, { key: 'Enter' });

 expect(await screen.findByText('Сервер не смог выполнить запрос.')).toBeTruthy();
 expect(
 (screen.getByRole('textbox', { name: 'Название подарка' }) as HTMLInputElement).value,
 ).toBe('Новое название');
 });

 it('цена: правка в ячейке сохраняет priceMinor в копейках', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([
 makeGift({ id: 'g1', title: 'Наушники', priceMinor: 2999000 }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: /29\s*990/ }));
 const input = screen.getByRole('textbox', { name: 'Цена подарка' });
 fireEvent.change(input, { target: { value: '1590,50' } });
 fireEvent.keyDown(input, { key: 'Enter' });

 await waitFor(() => {
 expect(screen.getByText(/1\s*590/)).toBeTruthy();
 });
 expect(patchCall(calls)?.body).toEqual({ priceMinor: 159050 });
 });

 it('приоритет: клик по значению открывает select и сохраняет выбор', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники', priority: 1 })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Очень важно' }));
 const select = screen.getByRole('combobox', { name: 'Приоритет подарка' });
 fireEvent.change(select, { target: { value: '4' } });
 fireEvent.keyDown(select, { key: 'Enter' });

 await waitFor(() => {
 expect(patchCall(calls)?.body).toEqual({ priority: 4 });
 });
 });

 it('описание видно в таблице и правится inline (PATCH {description})', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([
 makeGift({ id: 'g1', title: 'Наушники', description: 'Чёрные, с шумоподавлением' }),
 ]);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Чёрные, с шумоподавлением')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Чёрные, с шумоподавлением' }));
 const textarea = screen.getByRole('textbox', { name: 'Описание подарка' });
 fireEvent.change(textarea, {
 target: { value: 'Белые, с шумоподавлением' },
 });
 fireEvent.keyDown(textarea, { key: 'Enter' });

 expect(await screen.findByText('Белые, с шумоподавлением')).toBeTruthy();
 expect(patchCall(calls)?.body).toEqual({ description: 'Белые, с шумоподавлением' });
 });

 it('Esc отменяет правку описания без запроса', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([
 makeGift({ id: 'g1', title: 'Наушники', description: 'Чёрные' }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Чёрные');

 fireEvent.click(screen.getByRole('button', { name: 'Чёрные' }));
 const textarea = screen.getByRole('textbox', { name: 'Описание подарка' });
 fireEvent.change(textarea, { target: { value: 'Другое описание' } });
 fireEvent.keyDown(textarea, { key: 'Escape' });

 expect(screen.getByText('Чёрные')).toBeTruthy();
 expect(screen.queryByText('Другое описание')).toBeNull();
 expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
 });

 it('пустое описание можно заполнить из ячейки', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: '＋ описание' }));
 const textarea = screen.getByRole('textbox', { name: 'Описание подарка' });
 fireEvent.change(textarea, { target: { value: 'В подарок к наушникам' } });
 fireEvent.keyDown(textarea, { key: 'Enter' });

 expect(await screen.findByText('В подарок к наушникам')).toBeTruthy();
 expect(patchCall(calls)?.body).toEqual({ description: 'В подарок к наушникам' });
 });

 it('в таблице видны все ссылки до 6, остальные — за «＋N»', async () => {
 stubWideScreen();
 const links = Array.from({ length: 7 }, (_value, index) => `https://shop-${index + 1}.example/item`);
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники', links })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const visible = screen.getAllByRole('link', { name: /Открыть ссылку: / });
 expect(visible).toHaveLength(6);
 for (const link of visible) {
 expect(link.getAttribute('target')).toBe('_blank');
 expect(link.getAttribute('rel')).toBe('noopener noreferrer');
 }

 fireEvent.click(screen.getByRole('button', { name: 'Показать ещё 1 ссылку' }));
 expect(screen.getAllByRole('link', { name: /Открыть ссылку: / })).toHaveLength(7);

 fireEvent.click(screen.getByRole('button', { name: 'Свернуть ссылки' }));
 expect(screen.getAllByRole('link', { name: /Открыть ссылку: / })).toHaveLength(6);
 });

 it('без ссылок кнопок «Открыть» нет', async () => {
 stubWideScreen();
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 expect(screen.queryByRole('link', { name: /Открыть ссылку/ })).toBeNull();
 });
});

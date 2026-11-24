import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import {
 makeCategory,
 makeGift,
 makePublicWishlist,
 mockApi,
 mockEditorGifts,
 renderApp,
 stubMobileScreen,
 stubWideScreen,
 GUEST_VIEWER,
} from '../test/helpers';

const electronics = makeCategory('c1', 'Электроника');

function patchCalls(calls: ReturnType<typeof mockEditorGifts>['calls']) {
 return calls.filter((call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1');
}

describe('иконка редактирования и модалка', () => {
 it('вместо «Детали» — иконка-карандаш, которая открывает модалку', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники', description: 'Старое описание' })]);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 expect(screen.queryByText('Детали')).toBeNull();
 const pencil = screen.getByRole('button', { name: 'Редактировать подарок' });
 expect(pencil.getAttribute('title')).toBe('Редактировать');

 fireEvent.click(pencil);
 expect(await screen.findByRole('heading', { name: 'Редактировать подарок' })).toBeTruthy();
 expect(screen.getByRole('dialog')).toBeTruthy();
 });

 it('описание — обычное поле, видно сразу без «раскрыть»', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники', description: 'Старое описание' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 const description = (await screen.findByLabelText('Описание')) as HTMLTextAreaElement;
 expect(description.value).toBe('Старое описание');
 expect(description.tagName).toBe('TEXTAREA');
 expect(screen.queryByRole('button', { name: /Описание \(необязательно\)/ })).toBeNull();
 expect(screen.queryByRole('button', { name: /Скрыть описание/ })).toBeNull();

 // Остальные поля на месте.
 expect(screen.getByLabelText('Название')).toBeTruthy();
 expect(screen.getByLabelText('Цена, ₽')).toBeTruthy();
 expect(screen.getByLabelText('Приоритет')).toBeTruthy();
 expect(screen.getByText('Категории')).toBeTruthy();
 expect(screen.getByText('Ссылки на товар')).toBeTruthy();
 expect(screen.getByLabelText('Уже подарен')).toBeTruthy();
 });

 it('сохраняет одним PATCH только изменённые поля (пустое описание → null)', async () => {
 const { calls } = mockEditorGifts(
 [
 makeGift({
 id: 'g1',
 title: 'Наушники',
 description: 'Старое описание',
 priceMinor: 100000,
 priority: 2,
 links: ['https://shop.example/old'],
 }),
 ],
 [electronics],
 );

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.change(await screen.findByLabelText('Название'), {
 target: { value: 'Новые наушники' },
 });
 fireEvent.change(screen.getByLabelText('Описание'), { target: { value: '' } });
 fireEvent.change(screen.getByLabelText('Цена, ₽'), { target: { value: '2500' } });
 fireEvent.change(screen.getByLabelText('Приоритет'), { target: { value: '4' } });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить категорию «Электроника»' }));
 fireEvent.change(screen.getByLabelText('Подарка «Наушники»: Ссылка на товар 1'), {
 target: { value: 'https://shop.example/new' },
 });

 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(patchCalls(calls).map((call) => call.body)).toEqual([
 {
 title: 'Новые наушники',
 description: null,
 priceMinor: 250000,
 priority: 4,
 links: ['https://shop.example/new'],
 categoryIds: [electronics.id],
 },
 ]);
 });

 it('смена статуса вызывает status-эндпоинт, PATCH не отправляется', async () => {
 const { calls } = mockEditorGifts([
 makeGift({ id: 'g1', title: 'Наушники', status: 'available' }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.click(await screen.findByLabelText('Уже подарен'));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();
 const statusCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/gifts/g1/status',
 );
 expect(statusCall?.body).toEqual({ status: 'gifted' });
 expect(patchCalls(calls)).toHaveLength(0);
 });

 it('«Отмена» закрывает модалку без запросов и не меняет список', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.change(await screen.findByLabelText('Название'), {
 target: { value: 'Другое название' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getByText('Наушники')).toBeTruthy();
 expect(calls.some((call) => call.method === 'PATCH')).toBe(false);
 });

 it('удаляет подарок из модалки с подтверждением', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.click(await screen.findByRole('button', { name: 'Удалить' }));
 const confirmHeading = await screen.findByRole('heading', { name: 'Удалить подарок?' });
 const dialog = confirmHeading.closest('[role="dialog"]') as HTMLElement;
 expect(within(dialog).getByText(/нельзя отменить/)).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));

 expect(await screen.findByText('Подарок удалён')).toBeTruthy();
 expect(
 calls.some((call) => call.method === 'DELETE' && call.path === '/api/me/gifts/g1'),
 ).toBe(true);
 });

 it('на публичной странице иконки редактирования нет', async () => {
 mockApi({
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

 expect(screen.queryByRole('button', { name: 'Редактировать подарок' })).toBeNull();
 });
});

describe('создание подарка: описание в общей сетке', () => {
 it('в desktop-строке добавления описание в той же строке, без «＋ Описание»', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const titleInput = screen.getByLabelText('Название нового подарка');
 const descriptionInput = screen.getByLabelText('Описание нового подарка');

 // Описание — в той же строке таблицы, что и название.
 expect(descriptionInput.closest('tr')).toBe(titleInput.closest('tr'));
 expect(screen.queryByRole('button', { name: /Описание/ })).toBeNull();

 fireEvent.change(titleInput, { target: { value: 'Термокружка' } });
 fireEvent.change(descriptionInput, { target: { value: 'Белая, 500 мл' } });
 fireEvent.change(screen.getByLabelText('Цена нового подарка'), { target: { value: '1500' } });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Термокружка')).toBeTruthy();
 const postCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
 expect(postCall?.body).toEqual({
 title: 'Термокружка',
 priority: 3,
 description: 'Белая, 500 мл',
 priceMinor: 150000,
 });
 });

 it('Enter добавляет подарок с описанием', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.change(screen.getByLabelText('Название нового подарка'), {
 target: { value: 'Плед' },
 });
 fireEvent.change(screen.getByLabelText('Описание нового подарка'), {
 target: { value: 'Серый, 150×200' },
 });
 fireEvent.keyDown(screen.getByLabelText('Название нового подарка'), { key: 'Enter' });

 expect(await screen.findByText('Плед')).toBeTruthy();
 const postCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
 expect((postCall?.body as { description?: string }).description).toBe('Серый, 150×200');
 expect((postCall?.body as { title?: string }).title).toBe('Плед');
 });

 it('мобильная форма создания содержит поле «Описание» сразу', async () => {
 stubMobileScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: '＋ Подарок' }));
 expect(await screen.findByRole('heading', { name: 'Новый подарок' })).toBeTruthy();

 // Поле видно сразу, без «＋ Описание».
 expect(screen.queryByRole('button', { name: /Описание \(необязательно\)/ })).toBeNull();
 const description = screen.getByLabelText('Описание');
 expect(description.tagName).toBe('TEXTAREA');

 fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Кружка' } });
 fireEvent.change(description, { target: { value: 'Керамическая' } });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Кружка')).toBeTruthy();
 const postCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
 expect((postCall?.body as { description?: string }).description).toBe('Керамическая');
 });
});

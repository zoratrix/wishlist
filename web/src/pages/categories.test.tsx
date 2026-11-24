import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
 makeCategory,
 makeGift,
 makePublicWishlist,
 mockApi,
 mockEditorGifts,
 renderApp,
 stubWideScreen,
 GUEST_VIEWER,
} from '../test/helpers';

const electronics = makeCategory('c1', 'Электроника');
const books = makeCategory('c2', 'Книги');

describe('категории: отображение и фильтр', () => {
 it('показывает chips категорий под названием (таблица и карточки)', async () => {
 mockEditorGifts(
 [
 makeGift({ id: 'g1', title: 'Наушники', categories: [electronics, books] }),
 makeGift({ id: 'g2', title: 'Плед' }),
 ],
 [electronics, books],
 );

 const { container } = renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 const chips = screen.getAllByLabelText('Категории подарка');
 expect(chips).toHaveLength(1);
 expect(within(chips[0] as HTMLElement).getByText('Электроника')).toBeTruthy();
 expect(within(chips[0] as HTMLElement).getByText('Книги')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));
 expect(container.querySelector('[data-view="cards"]')).toBeTruthy();
 expect(screen.getAllByLabelText('Категории подарка')).toHaveLength(1);
 });

 it('скрывает chips и фильтр, если в списке нет категорий', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], []);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 expect(screen.queryByLabelText('Категории подарка')).toBeNull();
 expect(screen.queryByRole('group', { name: 'Фильтр по категориям' })).toBeNull();
 });

 it('фильтрует подарки по категории и «Без категории»', async () => {
 mockEditorGifts(
 [
 makeGift({ id: 'g1', title: 'Наушники', categories: [electronics] }),
 makeGift({ id: 'g2', title: 'Книга', categories: [books] }),
 makeGift({ id: 'g3', title: 'Плед' }),
 ],
 [electronics, books],
 );

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Книги' }));
 expect(screen.queryByText('Наушники')).toBeNull();
 expect(screen.getByText('Книга')).toBeTruthy();
 expect(screen.queryByText('Плед')).toBeNull();

 fireEvent.click(screen.getByRole('button', { name: 'Без категории' }));
 expect(screen.getByText('Плед')).toBeTruthy();
 expect(screen.queryByText('Наушники')).toBeNull();
 expect(screen.queryByText('Книга')).toBeNull();

 fireEvent.click(screen.getByRole('button', { name: 'Все' }));
 expect(screen.getByText('Наушники')).toBeTruthy();
 expect(screen.getByText('Книга')).toBeTruthy();
 expect(screen.getByText('Плед')).toBeTruthy();
 });
});

describe('категории: назначение в модалке', () => {
 it('назначает категорию и отправляет полный массив categoryIds при сохранении', async () => {
 const { calls } = mockEditorGifts(
 [makeGift({ id: 'g1', title: 'Наушники' })],
 [electronics, books],
 );

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.click(
 await screen.findByRole('button', { name: 'Добавить категорию «Электроника»' }),
 );
 expect(
 screen.getByRole('button', { name: 'Снять категорию «Электроника»' }),
 ).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();
 const patches = calls.filter(
 (call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1',
 );
 expect(patches.map((call) => call.body)).toEqual([{ categoryIds: [electronics.id] }]);
 });

 it('снимает назначенный тег и сохраняет пустой массив', async () => {
 const { calls } = mockEditorGifts(
 [makeGift({ id: 'g1', title: 'Наушники', categories: [electronics] })],
 [electronics, books],
 );

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.click(
 await screen.findByRole('button', { name: 'Снять категорию «Электроника»' }),
 );
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();
 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1',
 );
 expect(patchCall?.body).toEqual({ categoryIds: [] });
 });

 it('создаёт новую категорию в модалке и назначает её при сохранении', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], []);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 const nameInput = await screen.findByLabelText('Название новой категории');
 fireEvent.change(nameInput, { target: { value: 'Игрушки' } });
 fireEvent.keyDown(nameInput, { key: 'Enter' });

 expect(await screen.findByRole('button', { name: 'Снять категорию «Игрушки»' })).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();

 const createCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/categories',
 );
 expect(createCall?.body).toEqual({ name: 'Игрушки' });
 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1',
 );
 expect(patchCall?.body).toEqual({ categoryIds: ['c1'] });
 });
});

describe('категории: строка добавления', () => {
 it('select «Категория» отправляет categoryIds вместе с подарком', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts(
 [makeGift({ id: 'g1', title: 'Наушники' })],
 [electronics],
 );

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 fireEvent.change(screen.getByLabelText('Название нового подарка'), {
 target: { value: 'Термокружка' },
 });
 fireEvent.change(screen.getByLabelText('Категория нового подарка'), {
 target: { value: electronics.id },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Термокружка')).toBeTruthy();
 const postCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
 expect(postCall?.body).toEqual({
 title: 'Термокружка',
 priority: 3,
 categoryIds: [electronics.id],
 });
 });

 it('без категорий select не показывается, а POST уходит без categoryIds', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], []);

 renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();
 expect(screen.queryByLabelText('Категория нового подарка')).toBeNull();

 fireEvent.change(screen.getByLabelText('Название нового подарка'), {
 target: { value: 'Кружка' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Кружка')).toBeTruthy();
 const postCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
 expect(postCall?.body).toEqual({ title: 'Кружка', priority: 3 });
 });
});

describe('категории: публичная страница', () => {
 it('показывает chips и фильтр, но не даёт редактировать', async () => {
 mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 viewer: GUEST_VIEWER,
 wishlist: makePublicWishlist(),
 gifts: [
 makeGift({ id: 'g1', title: 'Наушники', categories: [electronics] }),
 makeGift({ id: 'g2', title: 'Книга', categories: [books] }),
 makeGift({ id: 'g3', title: 'Плед' }),
 ],
 categories: [electronics, books],
 },
 }),
 });

 renderApp('/w/token-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 expect(screen.getByRole('group', { name: 'Фильтр по категориям' })).toBeTruthy();
 expect(screen.getAllByLabelText('Категории подарка')).toHaveLength(2);

 fireEvent.click(screen.getByRole('button', { name: 'Книги' }));
 expect(screen.getByText('Книга')).toBeTruthy();
 expect(screen.queryByText('Наушники')).toBeNull();

 fireEvent.click(screen.getByRole('button', { name: 'Без категории' }));
 expect(screen.getByText('Плед')).toBeTruthy();
 expect(screen.queryByText('Книга')).toBeNull();

 // Правки категорий на публичной странице нет.
 expect(screen.queryByRole('button', { name: 'Детали' })).toBeNull();
 expect(screen.queryByLabelText('Название новой категории')).toBeNull();
 });

 it('скрывает фильтр, если у списка нет категорий', async () => {
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
 expect(await screen.findByText('Наушники')).toBeTruthy();
 expect(screen.queryByRole('group', { name: 'Фильтр по категориям' })).toBeNull();
 expect(screen.queryByLabelText('Категории подарка')).toBeNull();
 });
});

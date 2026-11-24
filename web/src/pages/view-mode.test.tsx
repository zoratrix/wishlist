import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { GiftDTO } from '../lib/types';
import { VIEW_MODE_KEY } from '../lib/view-mode';
import {
 makeGift,
 makePublicWishlist,
 makeWishlist,
 mockApi,
 renderApp,
 stubWideScreen,
 TEST_USER,
} from '../test/helpers';

const editorGifts: GiftDTO[] = [
 makeGift({ id: 'g1', title: 'Наушники', priority: 1, priceMinor: 2999000 }),
 makeGift({ id: 'g2', title: 'Книга о путешествиях', priority: 5 }),
];

function mockEditorApi() {
 return mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: { ...makeWishlist({ id: 'list-1' }), giftCount: editorGifts.length },
 gifts: editorGifts,
 },
 }),
 });
}

function mockPublicApi() {
 return mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist(),
 gifts: [makeGift({ id: 'g1', title: 'Наушники', priceMinor: 2999000 })],
 },
 }),
 });
}

describe('переключатель вида подарков', () => {
 it('показывает ровно два режима и по умолчанию «Таблица»', async () => {
 mockPublicApi();

 const { container } = renderApp('/w/token-1');
 await screen.findByText('Наушники');

 const switchGroup = screen.getByRole('group', { name: 'Вид подарков' });
 const buttons = within(switchGroup).getAllByRole('button');
 expect(buttons).toHaveLength(2);
 expect(buttons.map((button) => button.textContent)).toEqual(['Таблица', 'Карточки']);
 expect(
 within(switchGroup).getByRole('button', { name: 'Таблица' }).getAttribute('aria-pressed'),
 ).toBe('true');
 expect(container.querySelector('[data-view="table"]')).toBeTruthy();
 });

 it('сохранённый режим «Строки» мигрирует в «Таблицу»', async () => {
 window.localStorage.setItem(VIEW_MODE_KEY, 'rows');
 mockPublicApi();

 const { container } = renderApp('/w/token-1');
 await screen.findByText('Наушники');

 expect(container.querySelector('[data-view="table"]')).toBeTruthy();
 expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe('table');
 expect(screen.queryByRole('button', { name: 'Строки' })).toBeNull();
 });

 it('переключение на «Карточки» сохраняется и переживает перемонтирование', async () => {
 mockPublicApi();

 const first = renderApp('/w/token-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));

 expect(first.container.querySelector('[data-view="cards"]')).toBeTruthy();
 expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe('cards');

 first.unmount();
 const second = renderApp('/w/token-1');
 await screen.findByText('Наушники');
 expect(second.container.querySelector('[data-view="cards"]')).toBeTruthy();
 });

 it('в редакторе оба вида показывают те же подарки и иконку редактирования', async () => {
 mockEditorApi();

 const { container } = renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 const switchGroup = screen.getByRole('group', { name: 'Вид подарков' });

 fireEvent.click(within(switchGroup).getByRole('button', { name: 'Карточки' }));
 expect(container.querySelector('[data-view="cards"]')).toBeTruthy();
 expect(screen.getByText('Книга о путешествиях')).toBeTruthy();
 expect(screen.getAllByRole('button', { name: 'Редактировать подарок' })).toHaveLength(2);

 // Иконка открывает модалку редактирования.
 fireEvent.click(
 screen.getAllByRole('button', { name: 'Редактировать подарок' })[0] as HTMLElement,
 );
 expect(await screen.findByRole('button', { name: 'Сохранить' })).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

 fireEvent.click(within(switchGroup).getByRole('button', { name: 'Таблица' }));
 expect(container.querySelector('[data-view="table"]')).toBeTruthy();
 expect(screen.getAllByRole('button', { name: 'Редактировать подарок' })).toHaveLength(2);
 expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe('table');
 });

 it('на широком экране «Таблица» — настоящая таблица с колонками «Описание» и «Ссылки»', async () => {
 stubWideScreen();
 mockEditorApi();

 const { container } = renderApp('/app/lists/list-1');
 expect(await screen.findByText('Наушники')).toBeTruthy();

 expect(screen.getByRole('table')).toBeTruthy();
 for (const column of ['Название', 'Описание', 'Приоритет', 'Цена', 'Ссылки', 'Статус', 'Действия']) {
 expect(screen.getByRole('columnheader', { name: column })).toBeTruthy();
 }
 // Широкий адаптивный контейнер страницы редактора.
 expect(container.querySelector('.max-w-\\[1440px\\]')).toBeTruthy();
 // Внизу таблицы — строка добавления с полями в тех же колонках.
 expect(screen.getByLabelText('Название нового подарка')).toBeTruthy();
 expect(screen.getByLabelText('Приоритет нового подарка')).toBeTruthy();
 expect(screen.getByLabelText('Цена нового подарка')).toBeTruthy();
 expect(screen.getByLabelText('Ссылка на товар 1')).toBeTruthy();
 });

 it('карточки раскладываются в сетку 1/2/3/4 колонки', async () => {
 mockEditorApi();

 const { container } = renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));
 const grid = container.querySelector('[data-view="cards"] .grid');
 expect(grid).toBeTruthy();
 for (const className of ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', '2xl:grid-cols-4']) {
 expect(grid?.classList.contains(className)).toBe(true);
 }
 });

 it('на публичной странице в виде «Карточки» бронирование работает', async () => {
 mockPublicApi();

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));
 fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }));

 const dialog = await screen.findByRole('dialog');
 expect(within(dialog).getByText('Забронировать подарок')).toBeTruthy();
 expect(
 within(dialog).getByText(
 /Email нужен только для отмены брони и хранится только в этом браузере/,
 ),
 ).toBeTruthy();
 });
});

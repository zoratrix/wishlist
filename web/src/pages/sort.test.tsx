import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { GiftDTO } from '../lib/types';
import { SORT_KEY } from '../lib/sort';
import type { GiftSort } from '../lib/sort';
import {
 makeCategory,
 makeGift,
 makePublicWishlist,
 mockApi,
 mockEditorGifts,
 renderApp,
 renderedGiftIds,
 GUEST_VIEWER,
} from '../test/helpers';

const electronics = makeCategory('c1', 'Электроника');
const books = makeCategory('c2', 'Книги');

const gifts: GiftDTO[] = [
 makeGift({
 id: 'g1',
 title: 'Банан',
 createdAt: '2026-01-03T10:00:00.000Z',
 priceMinor: 30000,
 priority: 2,
 categories: [books],
 booking: { status: 'booked' },
 }),
 makeGift({
 id: 'g2',
 title: 'Апельсин',
 createdAt: '2026-01-01T10:00:00.000Z',
 priceMinor: 10000,
 priority: 1,
 categories: [electronics],
 }),
 makeGift({
 id: 'g3',
 title: 'Вишня',
 createdAt: '2026-01-02T10:00:00.000Z',
 priceMinor: 20000,
 priority: 3,
 }),
 makeGift({
 id: 'g4',
 title: 'Груша',
 createdAt: '2026-01-04T10:00:00.000Z',
 priceMinor: null,
 priority: 5,
 categories: [books],
 booking: { status: 'booked' },
 }),
];

const ORDER_CASES: Array<[GiftSort, string[]]> = [
 ['order', ['g1', 'g2', 'g3', 'g4']],
 ['newest', ['g4', 'g1', 'g3', 'g2']],
 ['oldest', ['g2', 'g3', 'g1', 'g4']],
 ['title-asc', ['g2', 'g1', 'g3', 'g4']],
 ['title-desc', ['g4', 'g3', 'g1', 'g2']],
 ['price-asc', ['g2', 'g3', 'g1', 'g4']],
 ['price-desc', ['g1', 'g3', 'g2', 'g4']],
 ['priority', ['g2', 'g1', 'g3', 'g4']],
 ['category', ['g1', 'g4', 'g2', 'g3']],
 ['available-first', ['g2', 'g3', 'g1', 'g4']],
 ['booked-first', ['g1', 'g4', 'g2', 'g3']],
];

function selectSort(value: GiftSort): void {
 fireEvent.change(screen.getByLabelText('Сортировка подарков'), { target: { value } });
}

function renderEditor(overrides: { showBooked?: boolean } = {}) {
 mockEditorGifts(gifts, [electronics, books], overrides);
 return renderApp('/app/lists/list-1');
}

describe('сортировка подарков в редакторе', () => {
 it('по умолчанию ручной порядок, все варианты дают ожидаемый порядок', async () => {
 for (const [sort, expected] of ORDER_CASES) {
 const { unmount } = renderEditor({ showBooked: true });
 await screen.findByText('Банан');

 selectSort(sort);

 const ids = renderedGiftIds(document.body);
 expect(ids, `сортировка ${sort}`).toEqual(expected);
 unmount();
 }
 });

 it('сортировка сохраняется в localStorage и восстанавливается', async () => {
 const first = renderEditor({ showBooked: true });
 await screen.findByText('Банан');

 selectSort('title-desc');
 expect(window.localStorage.getItem(SORT_KEY)).toBe('title-desc');
 expect(renderedGiftIds(document.body)).toEqual(['g4', 'g3', 'g1', 'g2']);

 first.unmount();
 renderEditor({ showBooked: true });
 await screen.findByText('Банан');
 expect(renderedGiftIds(document.body)).toEqual(['g4', 'g3', 'g1', 'g2']);
 });

 it('скрывает «Сначала свободные/занятые» у владельца при showBooked=false', async () => {
 renderEditor({ showBooked: false });
 await screen.findByText('Банан');

 const select = screen.getByLabelText('Сортировка подарков');
 expect(within(select).queryByRole('option', { name: 'Сначала свободные' })).toBeNull();
 expect(within(select).queryByRole('option', { name: 'Сначала занятые' })).toBeNull();
 expect(within(select).getByRole('option', { name: 'По порядку' })).toBeTruthy();
 });

 it('показывает «по занятости» у владельца при showBooked=true', async () => {
 renderEditor({ showBooked: true });
 await screen.findByText('Банан');

 const select = screen.getByLabelText('Сортировка подарков');
 expect(within(select).getByRole('option', { name: 'Сначала свободные' })).toBeTruthy();

 selectSort('available-first');
 expect(renderedGiftIds(document.body)).toEqual(['g2', 'g3', 'g1', 'g4']);
 });

 it('фильтр по категории применяется до сортировки', async () => {
 renderEditor({ showBooked: true });
 await screen.findByText('Банан');

 fireEvent.click(screen.getByRole('button', { name: 'Книги' }));
 expect(renderedGiftIds(document.body)).toEqual(['g1', 'g4']);

 selectSort('newest');
 expect(renderedGiftIds(document.body)).toEqual(['g4', 'g1']);
 });

 it('сортировка работает в режиме «Карточки»', async () => {
 renderEditor({ showBooked: true });
 await screen.findByText('Банан');

 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));
 selectSort('price-asc');
 expect(renderedGiftIds(document.body)).toEqual(['g2', 'g3', 'g1', 'g4']);
 });

 it('↑/↓ доступны только в «По порядку», иначе — подсказка', async () => {
 renderEditor({ showBooked: true });
 await screen.findByText('Банан');

 fireEvent.click(
 screen.getAllByRole('button', { name: 'Редактировать подарок' })[0] as HTMLElement,
 );
 expect(await screen.findByRole('button', { name: 'Переместить выше' })).toBeTruthy();

 selectSort('title-asc');
 expect(screen.queryByRole('button', { name: 'Переместить выше' })).toBeNull();
 expect(screen.getByText('Перестановка доступна в режиме «По порядку».')).toBeTruthy();

 selectSort('order');
 expect(await screen.findByRole('button', { name: 'Переместить выше' })).toBeTruthy();
 });
});

describe('сортировка на публичной странице', () => {
 it('сортирует подарки и не даёт управлять категориями', async () => {
 mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 viewer: GUEST_VIEWER,
 wishlist: makePublicWishlist(),
 gifts,
 categories: [electronics, books],
 },
 }),
 });

 const { container } = renderApp('/w/token-1');
 await screen.findByText('Банан');

 const select = screen.getByLabelText('Сортировка подарков');
 // Гостю сортировка по занятости доступна.
 expect(within(select).getByRole('option', { name: 'Сначала занятые' })).toBeTruthy();

 selectSort('booked-first');
 expect(renderedGiftIds(container)).toEqual(['g1', 'g4', 'g2', 'g3']);

 selectSort('order');
 expect(renderedGiftIds(container)).toEqual(['g1', 'g2', 'g3', 'g4']);

 // Управления категориями и редактирования на публичной странице нет.
 expect(screen.queryByRole('button', { name: '＋ Категория' })).toBeNull();
 expect(screen.queryByRole('button', { name: 'Изменить' })).toBeNull();
 expect(screen.queryByRole('button', { name: 'Редактировать подарок' })).toBeNull();
 });
});

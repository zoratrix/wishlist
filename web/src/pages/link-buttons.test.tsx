import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import {
 makeGift,
 makePublicWishlist,
 mockApi,
 mockEditorGifts,
 renderApp,
 stubWideScreen,
} from '../test/helpers';

const SIX_LINKS = [
 'https://ozon.ru/item',
 'https://shop-one.example/a',
 'https://shop-two.example/b',
 'https://shop-three.example/c',
 'https://shop-four.example/d',
 'https://shop-five.example/e',
];

function linkButtons() {
 return screen.queryAllByRole('link', { name: /^Открыть ссылку: / });
}

describe('квадратные кнопки ссылок', () => {
 it('в desktop-таблице: 6 ссылок — все кнопки без «＋N», 32×32, host в aria-label/title', async () => {
 stubWideScreen();
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники', links: SIX_LINKS })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const buttons = linkButtons();
 expect(buttons).toHaveLength(6);
 expect(screen.queryByRole('button', { name: /Показать ещё/ })).toBeNull();
 for (const button of buttons) {
 expect(button.getAttribute('target')).toBe('_blank');
 expect(button.getAttribute('rel')).toBe('noopener noreferrer');
 expect(button.getAttribute('title')).toBeTruthy();
 expect(button.className).toContain('h-8');
 expect(button.className).toContain('w-8');
 }
 // Видимого текста «Открыть» у кнопок нет.
 expect(screen.queryByText('Открыть')).toBeNull();
 });

 it('бренд ozon: монограмма O, фирменный цвет и favicon; неизвестный домен — нейтральный глобус', async () => {
 stubWideScreen();
 mockEditorGifts([
 makeGift({
 id: 'g1',
 title: 'Наушники',
 links: ['https://www.ozon.ru/item', 'https://shop.example/a'],
 }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const ozon = screen.getByRole('link', { name: 'Открыть ссылку: ozon.ru' });
 expect(ozon.getAttribute('title')).toBe('ozon.ru');
 expect(ozon.getAttribute('data-brand')).toBe('ozon');
 expect(ozon.style.backgroundColor).not.toBe('');
 expect(ozon.textContent).toContain('O');
 const favicon = ozon.querySelector('img');
 expect(favicon?.getAttribute('src')).toContain('ozon.ru');
 expect(favicon?.getAttribute('loading')).toBe('lazy');
 expect(favicon?.getAttribute('referrerpolicy')).toBe('no-referrer');

 // Ошибка загрузки favicon не ломает кнопку — остаётся монограмма.
 if (favicon) {
 fireEvent.error(favicon);
 }
 expect(ozon.textContent).toContain('O');
 expect(ozon.querySelector('img')).toBeNull();

 const neutral = screen.getByRole('link', { name: 'Открыть ссылку: shop.example' });
 expect(neutral.getAttribute('data-brand')).toBe('neutral');
 expect(neutral.querySelector('svg')).toBeTruthy();
 expect(neutral.querySelector('img')).toBeNull();
 });

 it('7+ ссылок: первые 6 + «＋N», раскрытие и сворачивание', async () => {
 stubWideScreen();
 mockEditorGifts([
 makeGift({ id: 'g1', title: 'Наушники', links: [...SIX_LINKS, 'https://shop-six.example/f'] }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 expect(linkButtons()).toHaveLength(6);
 const expand = screen.getByRole('button', { name: 'Показать ещё 1 ссылку' });
 expect(expand.textContent).toBe('＋1');

 fireEvent.click(expand);
 expect(linkButtons()).toHaveLength(7);

 fireEvent.click(screen.getByRole('button', { name: 'Свернуть ссылки' }));
 expect(linkButtons()).toHaveLength(6);
 });

 it('карточки: кнопки 36×36 (sm) и все ссылки ≤6', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники', links: SIX_LINKS })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));

 const buttons = linkButtons();
 expect(buttons).toHaveLength(6);
 for (const button of buttons) {
 expect(button.className).toContain('sm:h-9');
 expect(button.className).toContain('sm:w-9');
 expect(button.className).toContain('h-10');
 }
 });

 it('модалка редактирования: те же квадратные кнопки', async () => {
 mockEditorGifts([
 makeGift({ id: 'g1', title: 'Наушники', links: ['https://ozon.ru/item'] }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 expect(await screen.findByRole('heading', { name: 'Редактировать подарок' })).toBeTruthy();
 const dialog = screen.getByRole('dialog');
 expect(
 within(dialog).getByRole('link', { name: 'Открыть ссылку: ozon.ru' }),
 ).toBeTruthy();
 });

 it('публичная страница: все ссылки ≤6 (телефон 40×40), без видимого «Открыть»', async () => {
 mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist(),
 gifts: [makeGift({ id: 'g1', title: 'Наушники', links: SIX_LINKS })],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 const buttons = linkButtons();
 expect(buttons).toHaveLength(6);
 for (const button of buttons) {
 expect(button.className).toContain('h-10');
 expect(button.className).toContain('w-10');
 }
 expect(screen.queryByText('Открыть')).toBeNull();
 });
});

describe('ссылки в описании кликабельны', () => {
 it('на публичной странице: описание вишлиста и подарков линкуются', async () => {
 mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist({
 description: 'Подробности на https://ozon.ru/list.\nСпасибо!',
 }),
 gifts: [
 makeGift({
 id: 'g1',
 title: 'Наушники',
 description: 'Модель: https://market.yandex.ru/item, отзывы https://otzovik.ru/x',
 }),
 ],
 categories: [],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 // На телефоне компактные строки не показывают описание — переключаем карточки.
 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));

 const links = screen.getAllByRole('link', { name: /^https:\/\// });
 expect(links.map((link) => link.getAttribute('href'))).toEqual([
 'https://ozon.ru/list',
 'https://market.yandex.ru/item',
 'https://otzovik.ru/x',
 ]);
 for (const link of links) {
 expect(link.getAttribute('target')).toBe('_blank');
 expect(link.getAttribute('rel')).toBe('noopener noreferrer');
 }
 });

 it('в редакторе: описание вишлиста в шапке линкуется', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], [], {
 description: 'Список на https://ozon.ru/wish',
 });

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const link = screen.getByRole('link', { name: 'https://ozon.ru/wish' });
 expect(link.getAttribute('target')).toBe('_blank');
 expect(link.getAttribute('rel')).toBe('noopener noreferrer');
 });
});

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import {
 makeCategory,
 makeGift,
 makePublicWishlist,
 makeWishlist,
 mockApi,
 mockEditorGifts,
 renderApp,
 TEST_USER,
 GUEST_VIEWER,
} from '../test/helpers';

const red = makeCategory('c1', 'Электроника', '#5A7BA6');
const neutral = makeCategory('c2', 'Книги', null);

function pickColor(name: string): void {
 fireEvent.click(screen.getByRole('button', { name }));
}

describe('цвет категорий: свотчи и запросы', () => {
 it('создаёт категорию с выбранным цветом (POST color)', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], []);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: '＋ Категория' }));
 await screen.findByLabelText('Название новой категории списка');

 // Свотчи видны сразу, «по умолчанию» выбран изначально.
 expect(
 screen.getByRole('button', { name: 'Цвет по умолчанию новой категории' }).getAttribute(
 'aria-pressed',
 ),
 ).toBe('true');
 pickColor('Цвет #5A7BA6 новой категории');
 expect(
 screen.getByRole('button', { name: 'Цвет #5A7BA6 новой категории' }).getAttribute(
 'aria-pressed',
 ),
 ).toBe('true');
 expect(
 screen.getByRole('button', { name: 'Цвет по умолчанию новой категории' }).getAttribute(
 'aria-pressed',
 ),
 ).toBe('false');

 fireEvent.change(screen.getByLabelText('Название новой категории списка'), {
 target: { value: 'Электроника' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 const createCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/categories',
 );
 expect(createCall?.body).toEqual({ name: 'Электроника', color: '#5A7BA6' });

 // Чип фильтра получил цвет.
 const chip = await screen.findByRole('button', { name: 'Электроника' });
 expect(chip.getAttribute('data-color')).toBe('#5A7BA6');
 expect(chip.style.backgroundColor).not.toBe('');
 });

 it('по умолчанию отправляет color: null', async () => {
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], []);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: '＋ Категория' }));
 fireEvent.change(await screen.findByLabelText('Название новой категории списка'), {
 target: { value: 'Книги' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 const createCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/categories',
 );
 expect(createCall?.body).toEqual({ name: 'Книги', color: null });
 });

 it('меняет цвет существующей категории (PATCH color)', async () => {
 const { calls } = mockEditorGifts(
 [makeGift({ id: 'g1', title: 'Наушники' })],
 [red, neutral],
 );

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
 pickColor('Цвет #6E9B78 категории «Электроника»');

 expect(await screen.findByText('Цвет категории изменён.')).toBeTruthy();
 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/categories/c1',
 );
 expect(patchCall?.body).toEqual({ color: '#6E9B78' });

 // После обновления чип фильтра уже с новым цветом.
 const chip = await screen.findByRole('button', { name: 'Электроника' });
 expect(chip.getAttribute('data-color')).toBe('#6E9B78');
 });
 it('показывает ошибку API, если цвет не принят', async () => {
 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: {
 wishlist: { ...makeWishlist({ id: 'list-1' }), giftCount: 0 },
 gifts: [],
 categories: [red],
 },
 }),
 'PATCH /api/me/categories/c1': () => ({
 status: 400,
 body: { error: { code: 'INVALID_COLOR', message: 'Недопустимый цвет.' } },
 }),
 });

 renderApp('/app/lists/list-1');
 await screen.findByRole('button', { name: 'Изменить' });

 fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
 pickColor('Цвет #C4574D категории «Электроника»');

 expect(await screen.findByText('Недопустимый цвет.')).toBeTruthy();
 });
});

describe('цветные чипы', () => {
 it('фильтр и чипы подарков используют цвет категории, null — нейтральный', async () => {
 mockEditorGifts(
 [
 makeGift({
 id: 'g1',
 title: 'Наушники',
 categories: [red, neutral],
 }),
 ],
 [red, neutral],
 );

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const filterRed = screen.getByRole('button', { name: 'Электроника' });
 expect(filterRed.getAttribute('data-color')).toBe('#5A7BA6');
 expect(filterRed.style.backgroundColor).not.toBe('');

 const filterNeutral = screen.getByRole('button', { name: 'Книги' });
 expect(filterNeutral.getAttribute('data-color')).toBe('none');
 expect(filterNeutral.style.backgroundColor).toBe('');

 const giftChips = screen.getByLabelText('Категории подарка');
 const coloredChip = within(giftChips).getByText('Электроника');
 expect(coloredChip.getAttribute('data-color')).toBe('#5A7BA6');
 expect(coloredChip.style.backgroundColor).not.toBe('');
 const neutralChip = within(giftChips).getByText('Книги');
 expect(neutralChip.getAttribute('data-color')).toBe('none');
 expect(neutralChip.style.backgroundColor).toBe('');
 });

 it('чипы в модалке подарка цветные', async () => {
 mockEditorGifts(
 [makeGift({ id: 'g1', title: 'Наушники', categories: [red] })],
 [red, neutral],
 );

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 const assigned = await screen.findByRole('button', { name: 'Снять категорию «Электроника»' });
 expect(assigned.getAttribute('data-color')).toBe('#5A7BA6');
 expect(assigned.style.backgroundColor).not.toBe('');

 const available = screen.getByRole('button', { name: 'Добавить категорию «Книги»' });
 expect(available.getAttribute('data-color')).toBe('none');
 });

 it('публичная страница показывает цвета категорий и нейтральные чипы', async () => {
 mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 viewer: GUEST_VIEWER,
 wishlist: makePublicWishlist(),
 gifts: [
 makeGift({ id: 'g1', title: 'Наушники', categories: [red, neutral] }),
 makeGift({ id: 'g2', title: 'Плед' }),
 ],
 categories: [red, neutral],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 const filterRed = screen.getByRole('button', { name: 'Электроника' });
 expect(filterRed.getAttribute('data-color')).toBe('#5A7BA6');
 expect(filterRed.style.backgroundColor).not.toBe('');

 const giftChips = screen.getByLabelText('Категории подарка');
 expect(within(giftChips).getByText('Электроника').getAttribute('data-color')).toBe('#5A7BA6');
 expect(within(giftChips).getByText('Книги').getAttribute('data-color')).toBe('none');
 });
});

describe('короткая ссылка', () => {
 it('«Поделиться» использует shareToken с сервера как есть', async () => {
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], [], {
 shareToken: 'aB3xY9z',
 });

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));

 const expected = `${window.location.origin}/w/aB3xY9z`;
 expect(await screen.findByText(new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
 });

 it('длинный старый токен тоже выводится без обрезки', async () => {
 const longToken = 'anna-birthday-2026-long-token';
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })], [], {
 shareToken: longToken,
 });

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Поделиться' }));
 expect(await screen.findByText(new RegExp(longToken))).toBeTruthy();
 });
});

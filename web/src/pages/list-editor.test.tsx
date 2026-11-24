import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { GiftDTO } from '../lib/types';
import { makeGift, makeWishlist, mockApi, renderApp, TEST_USER } from '../test/helpers';

describe('редактор вишлиста', () => {
 it('показывает подарки из API и добавляет новый через форму «＋ Подарок»', async () => {
 let gifts: GiftDTO[] = [
 makeGift({ id: 'g1', title: 'Наушники', priceMinor: 2999000, priority: 1 }),
 makeGift({ id: 'g2', title: 'Книга о путешествиях', priority: 5 }),
 ];
 const wishlist = makeWishlist({ id: 'list-1', title: 'День рождения' });

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: { wishlist: { ...wishlist, giftCount: gifts.length }, gifts },
 }),
 'POST /api/me/wishlists/list-1/gifts': (call) => {
 const payload = call.body as { title: string };
 const gift = makeGift({ id: `g${gifts.length + 1}`, title: payload.title });
 gifts = [...gifts, gift];
 return { status: 201, body: { gift } };
 },
 });

 renderApp('/app/lists/list-1');

 expect(await screen.findByText('Наушники')).toBeTruthy();
 expect(screen.getByText('Книга о путешествиях')).toBeTruthy();

 // На телефоне добавление — через кнопку «＋ Подарок» и форму со всеми полями.
 fireEvent.click(screen.getByRole('button', { name: '＋ Подарок' }));
 expect(await screen.findByRole('heading', { name: 'Новый подарок' })).toBeTruthy();

 fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Термокружка' } });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Термокружка')).toBeTruthy();

 const postCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
 expect(postCall?.body).toEqual({ title: 'Термокружка', priority: 3 });
 });

 it('в брони без bookerName показывает только статус, без имени', async () => {
 const gifts = [makeGift({ id: 'g1', title: 'Плед', booking: { status: 'booked' } })];
 const wishlist = makeWishlist({ id: 'list-1' });

 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: { wishlist: { ...wishlist, giftCount: gifts.length }, gifts },
 }),
 });

 renderApp('/app/lists/list-1');

 expect(await screen.findByText('Забронировано')).toBeTruthy();
 expect(screen.queryByText(/Мария/)).toBeNull();
 expect(screen.queryByText(/Гость/)).toBeNull();
 });

 it('показывает имя бронирующего, если сервер его прислал владельцу', async () => {
 const gifts = [
 makeGift({ id: 'g1', title: 'Плед', booking: { status: 'booked', bookerName: 'Мария' } }),
 ];
 const wishlist = makeWishlist({ id: 'list-1' });

 mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: { wishlist: { ...wishlist, giftCount: gifts.length }, gifts },
 }),
 });

 renderApp('/app/lists/list-1');

 expect(await screen.findByText('Плед')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 expect(await screen.findByText(/Мария/)).toBeTruthy();
 });

 it('модалка редактирования сохраняет описание через PATCH', async () => {
 const gift = makeGift({ id: 'g1', title: 'Наушники', priceMinor: 2999000 });
 const gifts = [gift];
 const wishlist = makeWishlist({ id: 'list-1' });

 const { calls } = mockApi({
 'GET /api/auth/me': () => ({ body: { user: TEST_USER } }),
 'GET /api/me/wishlists/list-1': () => ({
 body: { wishlist: { ...wishlist, giftCount: gifts.length }, gifts, categories: [] },
 }),
 'PATCH /api/me/gifts/g1': (call) => ({
 body: { gift: { ...gift, ...(call.body as Record<string, unknown>) } },
 }),
 });

 renderApp('/app/lists/list-1');

 expect(await screen.findByText('Наушники')).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 const descriptionField = await screen.findByLabelText('Описание');
 fireEvent.change(descriptionField, { target: { value: 'Беспроводные, чёрные' } });
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();

 const patchCall = calls.find(
 (call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1',
 );
 expect(patchCall?.body).toEqual({ description: 'Беспроводные, чёрные' });
 });
});

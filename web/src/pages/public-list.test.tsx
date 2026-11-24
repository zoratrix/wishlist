import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { GiftDTO } from '../lib/types';
import { MY_BOOKINGS_KEY, rememberBooking } from '../lib/my-bookings';
import type { MyBookingRecord } from '../lib/my-bookings';
import { makeGift, makePublicWishlist, mockApi, renderApp } from '../test/helpers';

function readStoredBookings(): MyBookingRecord[] {
 const raw = window.localStorage.getItem(MY_BOOKINGS_KEY);
 return raw === null ? [] : (JSON.parse(raw) as MyBookingRecord[]);
}

function preloadBooking(overrides: Partial<MyBookingRecord> = {}): void {
 rememberBooking({
 shareToken: 'token-1',
 giftId: 'g1',
 name: 'Мария',
 email: 'maria@example.com',
 createdAt: '2026-11-12T10:00:00.000Z',
 ...overrides,
 });
}

describe('публичная страница вишлиста', () => {
 it('для свободного подарка показывает «Забронировать», для занятого — «Занят»', async () => {
 const gifts = [
 makeGift({ id: 'g1', title: 'Наушники', priceMinor: 2999000 }),
 makeGift({ id: 'g2', title: 'Сертификат в кино', booking: { status: 'booked' } }),
 ];

 mockApi({
 'GET /api/w/token-1': () => ({ body: { wishlist: makePublicWishlist(), gifts } }),
 });

 renderApp('/w/token-1');

 expect(await screen.findByText('Наушники')).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Забронировать' })).toBeTruthy();
 expect(screen.getByText('Занят')).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Отменить бронирование' })).toBeTruthy();
 });

 it('бронирует подарок, показывает сообщение и не раскрывает имя бронирующего', async () => {
 let gifts: GiftDTO[] = [
 makeGift({ id: 'g1', title: 'Наушники' }),
 // Сервер не должен присылать имя гостю, но клиент обязан его не показывать даже если пришло.
 makeGift({ id: 'g2', title: 'Сертификат', booking: { status: 'booked', bookerName: 'Мария' } }),
 ];

 const { calls } = mockApi({
 'GET /api/w/token-1': () => ({ body: { wishlist: makePublicWishlist(), gifts } }),
 'POST /api/w/token-1/gifts/g1/book': () => {
 gifts = gifts.map((gift) =>
 gift.id === 'g1' ? { ...gift, booking: { status: 'booked' } } : gift,
 );
 return { status: 201, body: { booking: { createdAt: '2026-11-12T10:00:00.000Z' } } };
 },
 });

 renderApp('/w/token-1');

 expect(await screen.findByText('Наушники')).toBeTruthy();
 expect(screen.queryByText(/Мария/)).toBeNull();

 fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }));

 const dialog = await screen.findByRole('dialog');
 expect(within(dialog).getByText('Забронировать подарок')).toBeTruthy();

 fireEvent.change(within(dialog).getByLabelText('Ваше имя'), { target: { value: 'Пётр' } });
 fireEvent.change(within(dialog).getByLabelText('Электронная почта'), {
 target: { value: 'petr@example.com' },
 });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Забронировать' }));

 expect(await screen.findByText(/Готово! Подарок забронирован\./)).toBeTruthy();

 const bookCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/w/token-1/gifts/g1/book',
 );
 expect(bookCall?.body).toEqual({ name: 'Пётр', email: 'petr@example.com' });
 expect(screen.queryByText(/Мария/)).toBeNull();
 });

 it('для недоступного списка показывает «Страница не найдена или недоступна»', async () => {
 mockApi({
 'GET /api/w/bad-token': () => ({
 status: 404,
 body: { error: { code: 'NOT_FOUND', message: 'Ничего не найдено.' } },
 }),
 });

 renderApp('/w/bad-token');

 expect(await screen.findByText('Страница не найдена или недоступна.')).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
 });

 it('показывает квадратные кнопки ссылок с host, без видимого «Открыть»', async () => {
 const gifts = [
 makeGift({
 id: 'g1',
 title: 'Наушники',
 links: ['https://shop-one.example/headphones', 'https://shop-two.example/headphones'],
 }),
 makeGift({ id: 'g2', title: 'Без ссылок' }),
 ];

 mockApi({
 'GET /api/w/token-1': () => ({ body: { wishlist: makePublicWishlist(), gifts } }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Без ссылок');

 // Ссылок ≤6 — видны все сразу, без «＋N».
 const links = screen.getAllByRole('link', { name: /Открыть ссылку: / });
 expect(links).toHaveLength(2);
 expect(screen.queryByRole('button', { name: /Показать ещё/ })).toBeNull();
 for (const link of links) {
 expect(link.getAttribute('target')).toBe('_blank');
 expect(link.getAttribute('rel')).toBe('noopener noreferrer');
 expect(link.getAttribute('title')).toBeTruthy();
 }
 // Видимого текста «Открыть» у кнопок нет.
 expect(screen.queryByText('Открыть')).toBeNull();

 // В карточках все ссылки тоже отдельными кнопками.
 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));
 expect(screen.getAllByRole('link', { name: /Открыть ссылку: / })).toHaveLength(2);

 // Правки на публичной странице нет.
 expect(screen.queryByRole('button', { name: 'Редактировать подарок' })).toBeNull();
 expect(screen.queryByRole('button', { name: '＋ Подарок' })).toBeNull();
 });

 it('после бронирования помечает подарок «Забронировано вами» и переживает перемонтирование', async () => {
 let gifts: GiftDTO[] = [makeGift({ id: 'g1', title: 'Наушники' })];

 mockApi({
 'GET /api/w/token-1': () => ({ body: { wishlist: makePublicWishlist(), gifts } }),
 'POST /api/w/token-1/gifts/g1/book': () => {
 gifts = gifts.map((gift) =>
 gift.id === 'g1' ? { ...gift, booking: { status: 'booked' } } : gift,
 );
 return { status: 201, body: { booking: { createdAt: '2026-11-12T10:00:00.000Z' } } };
 },
 });

 const first = renderApp('/w/token-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Забронировать' }));
 const dialog = await screen.findByRole('dialog');
 fireEvent.change(within(dialog).getByLabelText('Ваше имя'), { target: { value: 'Пётр' } });
 fireEvent.change(within(dialog).getByLabelText('Электронная почта'), {
 target: { value: 'petr@example.com' },
 });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Забронировать' }));

 expect(await screen.findByText('Забронировано вами')).toBeTruthy();
 expect(
 await screen.findByText(/Отметка «Забронировано вами» хранится только в этом браузере/),
 ).toBeTruthy();

 const record = readStoredBookings()[0];
 expect(record).toMatchObject({
 shareToken: 'token-1',
 giftId: 'g1',
 name: 'Пётр',
 email: 'petr@example.com',
 });

 first.unmount();
 renderApp('/w/token-1');

 expect(await screen.findByText('Забронировано вами')).toBeTruthy();
 });

 it('после отмены удаляет запись и снова предлагает «Забронировать»', async () => {
 preloadBooking({ email: 'maria@example.com' });
 let gifts: GiftDTO[] = [
 makeGift({ id: 'g1', title: 'Наушники', booking: { status: 'booked' } }),
 ];

 const { calls } = mockApi({
 'GET /api/w/token-1': () => ({ body: { wishlist: makePublicWishlist(), gifts } }),
 'POST /api/w/token-1/gifts/g1/unbook': () => {
 gifts = [makeGift({ id: 'g1', title: 'Наушники' })];
 return { body: { ok: true } };
 },
 });

 renderApp('/w/token-1');
 expect(await screen.findByText('Забронировано вами')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Отменить бронирование' }));

 const dialog = await screen.findByRole('dialog');
 const emailInput = within(dialog).getByLabelText('Электронная почта') as HTMLInputElement;
 // Email подставлен из отметки в браузере…
 expect(emailInput.value).toBe('maria@example.com');
 // …и поле остаётся редактируемым.
 fireEvent.change(emailInput, { target: { value: 'other@example.com' } });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить бронирование' }));

 expect(await screen.findByText('Бронирование отменено.')).toBeTruthy();
 expect(await screen.findByRole('button', { name: 'Забронировать' })).toBeTruthy();

 const unbookCall = calls.find(
 (call) => call.method === 'POST' && call.path === '/api/w/token-1/gifts/g1/unbook',
 );
 expect(unbookCall?.body).toEqual({ email: 'other@example.com' });
 expect(readStoredBookings()).toHaveLength(0);
 });

 it('удаляет устаревшую отметку, если сервер отдал подарок свободным', async () => {
 preloadBooking();
 mockApi({
 'GET /api/w/token-1': () => ({
 body: {
 wishlist: makePublicWishlist(),
 gifts: [makeGift({ id: 'g1', title: 'Наушники' })],
 },
 }),
 });

 renderApp('/w/token-1');
 await screen.findByText('Наушники');

 await waitFor(() => {
 expect(readStoredBookings()).toHaveLength(0);
 });
 expect(screen.getByText('Свободен')).toBeTruthy();
 });

 it('работает как раньше, если localStorage недоступен', async () => {
 vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
 throw new Error('storage запрещён');
 });
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
 throw new Error('storage запрещён');
 });

 const gifts = [
 makeGift({ id: 'g1', title: 'Наушники' }),
 makeGift({ id: 'g2', title: 'Плед', booking: { status: 'booked' } }),
 ];

 mockApi({
 'GET /api/w/token-1': () => ({ body: { wishlist: makePublicWishlist(), gifts } }),
 });

 renderApp('/w/token-1');

 expect(await screen.findByText('Наушники')).toBeTruthy();
 expect(screen.getByRole('button', { name: 'Забронировать' })).toBeTruthy();
 expect(screen.getByText('Занят')).toBeTruthy();
 // «Забронировано вами» без хранилища невозможно — и это не ломает страницу.
 expect(screen.queryByText('Забронировано вами')).toBeNull();
 });
});

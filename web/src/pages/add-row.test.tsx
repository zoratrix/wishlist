import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
 makeGift,
 mockEditorGifts,
 renderApp,
 stubMobileScreen,
 stubWideScreen,
} from '../test/helpers';

function postCalls(calls: ReturnType<typeof mockEditorGifts>['calls']) {
 return calls.filter(
 (call) => call.method === 'POST' && call.path === '/api/me/wishlists/list-1/gifts',
 );
}

describe('строка добавления в таблице', () => {
 it('добавляет подарок со всеми полями одним POST', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.change(screen.getByLabelText('Название нового подарка'), {
 target: { value: 'Термокружка' },
 });
 fireEvent.change(screen.getByLabelText('Приоритет нового подарка'), {
 target: { value: '1' },
 });
 fireEvent.change(screen.getByLabelText('Цена нового подарка'), {
 target: { value: '1500' },
 });
 fireEvent.change(screen.getByLabelText('Ссылка на товар 1'), {
 target: { value: 'https://shop.example/cup' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Термокружка')).toBeTruthy();
 expect(postCalls(calls)[0]?.body).toEqual({
 title: 'Термокружка',
 priority: 1,
 priceMinor: 150000,
 links: ['https://shop.example/cup'],
 });
 });

 it('добавляет подарок с двумя ссылками: «＋ Ещё ссылка» добавляет поле', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.change(screen.getByLabelText('Название нового подарка'), {
 target: { value: 'Плед' },
 });
 fireEvent.change(screen.getByLabelText('Ссылка на товар 1'), {
 target: { value: 'https://shop-one.example/plaid' },
 });
 fireEvent.click(screen.getByRole('button', { name: '＋ Ещё ссылка' }));
 fireEvent.change(screen.getByLabelText('Ссылка на товар 2'), {
 target: { value: 'https://shop-two.example/plaid' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Плед')).toBeTruthy();
 expect(postCalls(calls)[0]?.body).toEqual({
 title: 'Плед',
 priority: 3,
 links: ['https://shop-one.example/plaid', 'https://shop-two.example/plaid'],
 });
 });

 it('крестик «убрать» удаляет поле ссылки', async () => {
 stubWideScreen();
 mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: '＋ Ещё ссылка' }));
 expect(screen.getByLabelText('Ссылка на товар 2')).toBeTruthy();

 fireEvent.click(screen.getByRole('button', { name: 'Убрать ссылку 2' }));
 expect(screen.queryByLabelText('Ссылка на товар 2')).toBeNull();
 });

 it('Enter в поле добавляет, очищает строку, возвращает фокус и позволяет добавить подряд', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 const titleInput = () => screen.getByLabelText('Название нового подарка') as HTMLInputElement;

 fireEvent.change(titleInput(), { target: { value: 'Плед' } });
 fireEvent.keyDown(titleInput(), { key: 'Enter' });

 expect(await screen.findByText('Плед')).toBeTruthy();
 expect(titleInput().value).toBe('');
 expect(document.activeElement).toBe(titleInput());

 fireEvent.change(titleInput(), { target: { value: 'Кружка' } });
 fireEvent.keyDown(titleInput(), { key: 'Enter' });

 expect(await screen.findByText('Кружка')).toBeTruthy();
 expect(postCalls(calls).map((call) => (call.body as { title: string }).title)).toEqual([
 'Плед',
 'Кружка',
 ]);
 });

 it('пустое название не отправляется и показывает подсказку', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Введите название подарка.')).toBeTruthy();
 expect(postCalls(calls)).toHaveLength(0);
 });

 it('описание вводится в общей строке добавления и уходит в POST', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.change(screen.getByLabelText('Название нового подарка'), {
 target: { value: 'Термокружка' },
 });
 fireEvent.change(screen.getByLabelText('Описание нового подарка'), {
 target: { value: 'Белая, 500 мл' },
 });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 expect(await screen.findByText('Термокружка')).toBeTruthy();
 expect((postCalls(calls)[0]?.body as { description?: string }).description).toBe(
 'Белая, 500 мл',
 );
 });
});

describe('добавление на телефоне', () => {
 it('«＋ Подарок» открывает форму со всеми полями и остаётся открытой после добавления', async () => {
 stubMobileScreen();
 const { calls } = mockEditorGifts([makeGift({ id: 'g1', title: 'Наушники' })]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');

 fireEvent.click(screen.getByRole('button', { name: '＋ Подарок' }));
 expect(await screen.findByRole('heading', { name: 'Новый подарок' })).toBeTruthy();
 expect(screen.getByLabelText('Название')).toBeTruthy();
 expect(screen.getByLabelText('Приоритет')).toBeTruthy();
 expect(screen.getByLabelText('Цена, ₽')).toBeTruthy();
 expect(screen.getByLabelText('Нового подарка: Ссылка на товар 1')).toBeTruthy();

 fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Плед' } });
 fireEvent.change(screen.getByLabelText('Цена, ₽'), { target: { value: '800' } });
 fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

 await waitFor(() => {
 expect(screen.getByText('Плед')).toBeTruthy();
 });
 expect(screen.getByRole('heading', { name: 'Новый подарок' })).toBeTruthy();
 expect(postCalls(calls)[0]?.body).toEqual({ title: 'Плед', priority: 3, priceMinor: 80000 });
 });
});

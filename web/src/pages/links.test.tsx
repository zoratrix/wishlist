import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { makeGift, mockEditorGifts, renderApp, stubWideScreen } from '../test/helpers';

function patchCall(calls: ReturnType<typeof mockEditorGifts>['calls']) {
 return calls.find((call) => call.method === 'PATCH' && call.path === '/api/me/gifts/g1');
}

describe('несколько ссылок в модалке подарка', () => {
 it('добавляет и меняет ссылки, сохраняя полный массив через PATCH', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([
 makeGift({
 id: 'g1',
 title: 'Наушники',
 links: ['https://shop-one.example/headphones', 'https://shop-two.example/headphones'],
 }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 const firstLink = screen.getByLabelText(
 'Подарка «Наушники»: Ссылка на товар 1',
 ) as HTMLInputElement;
 expect(firstLink.value).toBe('https://shop-one.example/headphones');
 fireEvent.change(firstLink, { target: { value: 'https://shop-three.example/headphones' } });

 fireEvent.click(
 screen.getByRole('button', { name: 'Подарка «Наушники»: Добавить ссылку' }),
 );
 fireEvent.change(screen.getByLabelText('Подарка «Наушники»: Ссылка на товар 3'), {
 target: { value: 'https://shop-four.example/headphones' },
 });

 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();
 expect(patchCall(calls)?.body).toEqual({
 links: [
 'https://shop-three.example/headphones',
 'https://shop-two.example/headphones',
 'https://shop-four.example/headphones',
 ],
 });
 });

 it('удаляет ссылку и сохраняет остаток', async () => {
 stubWideScreen();
 const { calls } = mockEditorGifts([
 makeGift({
 id: 'g1',
 title: 'Наушники',
 links: ['https://shop-one.example/headphones', 'https://shop-two.example/headphones'],
 }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Редактировать подарок' }));

 fireEvent.click(screen.getByRole('button', { name: 'Подарка «Наушники»: Убрать ссылку 1' }));
 fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

 expect(await screen.findByText('Сохранено')).toBeTruthy();
 expect(patchCall(calls)?.body).toEqual({
 links: ['https://shop-two.example/headphones'],
 });
 });

 it('в карточках редактора все ссылки — отдельными кнопками', async () => {
 mockEditorGifts([
 makeGift({
 id: 'g1',
 title: 'Наушники',
 links: [
 'https://shop-one.example/headphones',
 'https://shop-two.example/headphones',
 'https://shop-three.example/headphones',
 ],
 }),
 ]);

 renderApp('/app/lists/list-1');
 await screen.findByText('Наушники');
 fireEvent.click(screen.getByRole('button', { name: 'Карточки' }));

 expect(screen.getAllByRole('link', { name: /Открыть ссылку: / })).toHaveLength(3);
 });
});

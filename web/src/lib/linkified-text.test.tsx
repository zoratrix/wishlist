import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LinkifiedText } from '../components/linkified-text';
import { splitLinkifiedText } from './linkify';

describe('splitLinkifiedText', () => {
 it('находит несколько ссылок и обрезает хвостовую пунктуацию', () => {
 const parts = splitLinkifiedText(
 'Смотри https://one.ru/item, потом (https://two.ru/x). И всё!',
 );

 const links = parts.filter((part) => part.type === 'link').map((part) => part.value);
 expect(links).toEqual(['https://one.ru/item', 'https://two.ru/x']);
 expect(parts.map((part) => part.value).join('')).toBe(
 'Смотри https://one.ru/item, потом (https://two.ru/x). И всё!',
 );
 });

 it('не линкует javascript: и прочие схемы', () => {
 const parts = splitLinkifiedText('javascript:alert(1) и ftp://files.ru/a');
 expect(parts.filter((part) => part.type === 'link')).toHaveLength(0);
 });
});

describe('LinkifiedText', () => {
 it('рендерит http/https-ссылки кликабельными в новой вкладке', () => {
 render(<LinkifiedText text="Товар: https://ozon.ru/item и всё" />);

 const link = screen.getByRole('link');
 expect(link.getAttribute('href')).toBe('https://ozon.ru/item');
 expect(link.getAttribute('target')).toBe('_blank');
 expect(link.getAttribute('rel')).toBe('noopener noreferrer');
 expect(link.textContent).toBe('https://ozon.ru/item');
 });

 it('не съедает тело ссылки, но выносит точку из неё', () => {
 const { container } = render(<LinkifiedText text="Ссылка: https://ozon.ru/item." />);

 const link = screen.getByRole('link');
 expect(link.getAttribute('href')).toBe('https://ozon.ru/item');
 expect(container.textContent).toContain('https://ozon.ru/item.');
 });

 it('поддерживает несколько ссылок и обычный текст без ссылок', () => {
 const { container, rerender } = render(
 <LinkifiedText text={'Первая https://one.ru/a\nВторая https://two.ru/b'} />,
 );
 expect(screen.getAllByRole('link')).toHaveLength(2);
 // Перенос строки сохраняется (whitespace-pre-line + исходный \n в тексте).
 expect(container.textContent).toContain('\n');
 expect(container.querySelector('.whitespace-pre-line')).toBeTruthy();

 rerender(<LinkifiedText text="Просто текст без ссылок" />);
 expect(screen.queryAllByRole('link')).toHaveLength(0);
 expect(container.textContent).toBe('Просто текст без ссылок');
 });

 it('javascript: не становится ссылкой', () => {
 const { container } = render(
 <LinkifiedText text="javascript:alert(1), но вот https://safe.ru." />,
 );

 const links = screen.getAllByRole('link');
 expect(links).toHaveLength(1);
 expect(links[0]?.getAttribute('href')).toBe('https://safe.ru');
 expect(container.querySelector('a[href^="javascript"]')).toBeNull();
 });

 it('пустой текст ничего не рендерит', () => {
 const { container } = render(<LinkifiedText text={null} />);
 expect(container.textContent).toBe('');
 });
});

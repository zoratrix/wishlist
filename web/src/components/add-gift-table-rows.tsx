import { priorityMeta } from '../lib/format';
import { MAX_GIFT_LINKS } from '../lib/links';
import type { CategoryDTO } from '../lib/types';
import { useGiftAdd } from '../hooks/use-gift-add';
import { Button } from './button';

/* Поля строки добавления — маленькие «наклейки» с чёрной рамкой 2px. */
const INPUT_CLASS = [
 'w-full min-h-10 rounded-md border border-ink bg-card px-2 py-1',
 'text-sm font-medium text-ink',
 'placeholder:font-normal placeholder:text-muted',
 'transition-shadow focus:outline-none',
].join(' ');

const PRIORITIES = [1, 2, 3, 4, 5].map((value) => priorityMeta(value));

/**
 * Строка добавления внизу desktop-таблицы: все поля, включая описание,
 * в тех же колонках. Enter — добавить и оставить строку для следующего подарка.
 */
export function AddGiftTableRows({
 listId,
 categories,
}: {
 listId: string;
 categories: CategoryDTO[];
}) {
 const add = useGiftAdd(listId);

 return (
 <tr className="border-b border-line bg-butter-soft/40">
 <td className="px-3 py-2 text-base font-semibold text-ink">＋</td>
 <td className="px-2 py-1.5">
 <input
 ref={add.titleRef}
 aria-label="Название нового подарка"
 value={add.fields.title}
 placeholder="Название подарка"
 maxLength={200}
 onChange={(event) => add.setField('title', event.target.value)}
 onKeyDown={add.handleKeyDown}
 className={INPUT_CLASS}
 />
 {add.error ? (
 <p role="alert" className="mt-1 text-xs font-bold text-danger">
 {add.error}
 </p>
 ) : null}
 </td>
 <td className="hidden px-2 py-1.5 lg:table-cell">
 <textarea
 aria-label="Описание нового подарка"
 rows={2}
 value={add.fields.description}
 placeholder="Описание (необязательно)"
 onChange={(event) => add.setField('description', event.target.value)}
 className={[INPUT_CLASS, 'min-h-16 resize-y'].join(' ')}
 />
 </td>
 <td className="px-2 py-1.5">
 <select
 aria-label="Приоритет нового подарка"
 value={add.fields.priority}
 onChange={(event) => add.setField('priority', event.target.value)}
 onKeyDown={add.handleKeyDown}
 className={INPUT_CLASS}
 >
 {PRIORITIES.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </td>
 <td className="px-2 py-1.5">
 <input
 aria-label="Цена нового подарка"
 inputMode="decimal"
 value={add.fields.price}
 placeholder="₽"
 onChange={(event) => add.setField('price', event.target.value)}
 onKeyDown={add.handleKeyDown}
 className={INPUT_CLASS}
 />
 </td>
 <td className="px-2 py-1.5">
 <div className="space-y-1">
 {add.fields.links.map((link, index) => (
 <div key={index} className="flex items-center gap-1">
 <input
 aria-label={`Ссылка на товар ${index + 1}`}
 inputMode="url"
 value={link}
 placeholder="https://…"
 maxLength={2000}
 onChange={(event) => add.setLink(index, event.target.value)}
 onKeyDown={add.handleKeyDown}
 className={INPUT_CLASS}
 />
 <button
 type="button"
 aria-label={`Убрать ссылку ${index + 1}`}
 onClick={() => add.removeLink(index)}
 className={[
 'nb-focus flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md',
 'border border-line bg-card text-sm font-semibold text-ink',
 ' hover:bg-danger-soft',
 ].join(' ')}
 >
 ✕
 </button>
 </div>
 ))}
 {add.fields.links.length < MAX_GIFT_LINKS ? (
 <button
 type="button"
 onClick={add.addLink}
 className={[
 'nb-focus min-h-10 w-full rounded-md border border-dashed border-ink px-2',
 'text-left text-xs font-bold text-ink hover:bg-card',
 ].join(' ')}
 >
 ＋ Ещё ссылка
 </button>
 ) : null}
 </div>
 </td>
 <td className="px-2 py-1.5">
 {categories.length > 0 ? (
 <select
 aria-label="Категория нового подарка"
 value={add.fields.categoryId}
 onChange={(event) => add.setField('categoryId', event.target.value)}
 onKeyDown={add.handleKeyDown}
 className={INPUT_CLASS}
 >
 <option value="">Без категории</option>
 {categories.map((category) => (
 <option key={category.id} value={category.id}>
 {category.name}
 </option>
 ))}
 </select>
 ) : null}
 </td>
 <td className="px-2 py-1.5">
 <div className="flex flex-col items-end gap-1">
 <Button size="sm" loading={add.isPending} onClick={add.submit}>
 Добавить
 </Button>
 <span className="text-[11px] font-bold leading-tight text-muted">
 Enter — добавить и продолжить
 </span>
 </div>
 </td>
 </tr>
 );
}

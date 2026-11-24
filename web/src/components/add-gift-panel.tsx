import { useState } from 'react';
import { priorityMeta } from '../lib/format';
import type { CategoryDTO } from '../lib/types';
import { useGiftAdd } from '../hooks/use-gift-add';
import { Button } from './button';
import { SelectField, TextAreaField, TextField } from './field';
import { LinksEditor } from './links-editor';
import { Notice } from './notice';

const PRIORITIES = [1, 2, 3, 4, 5].map((value) => priorityMeta(value));

/**
 * «＋ Подарок» на телефоне и в карточках: та же строка добавления,
 * но вертикально и с подписями полей. После добавления остаётся открытой.
 * Форма — карточка-наклейка с чёрной рамкой 2px и жёсткой тенью.
 */
export function AddGiftPanel({
 listId,
 categories,
}: {
 listId: string;
 categories: CategoryDTO[];
}) {
 const add = useGiftAdd(listId);
 const [open, setOpen] = useState(false);

 if (!open) {
 return (
 <div className="mt-4">
 <Button className="w-full" onClick={() => setOpen(true)}>
 ＋ Подарок
 </Button>
 </div>
 );
 }

 return (
 <form
 className="mt-4 space-y-3 rounded-2xl border border-line bg-card p-4"
 onSubmit={(event) => {
 event.preventDefault();
 add.submit();
 }}
 noValidate
 >
 <div className="flex items-center justify-between gap-2">
 <h3 className="min-w-0 text-base font-semibold tracking-tight text-ink">
 Новый подарок
 </h3>
 <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
 Свернуть
 </Button>
 </div>

 <TextField
 label="Название"
 value={add.fields.title}
 maxLength={200}
 placeholder="Например, Наушники"
 onChange={(event) => add.setField('title', event.target.value)}
 onKeyDown={add.handleKeyDown}
 />

 <TextAreaField
 label="Описание"
 rows={2}
 value={add.fields.description}
 placeholder="Необязательно: цвет, размер, где посмотреть…"
 onChange={(event) => add.setField('description', event.target.value)}
 />

 <div className="grid grid-cols-2 gap-3">
 <SelectField
 className="min-w-0"
 label="Приоритет"
 value={add.fields.priority}
 onChange={(event) => add.setField('priority', event.target.value)}
 onKeyDown={add.handleKeyDown}
 >
 {PRIORITIES.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </SelectField>

 <TextField
 className="min-w-0"
 label="Цена, ₽"
 inputMode="decimal"
 value={add.fields.price}
 onChange={(event) => add.setField('price', event.target.value)}
 onKeyDown={add.handleKeyDown}
 />
 </div>

 <LinksEditor
 links={add.fields.links}
 onChange={add.setLinks}
 labelPrefix="Нового подарка: "
 />

 {categories.length > 0 ? (
 <SelectField
 label="Категория"
 value={add.fields.categoryId}
 onChange={(event) => add.setField('categoryId', event.target.value)}
 onKeyDown={add.handleKeyDown}
 >
 <option value="">Без категории</option>
 {categories.map((category) => (
 <option key={category.id} value={category.id}>
 {category.name}
 </option>
 ))}
 </SelectField>
 ) : null}

 {add.error ? (
 <Notice kind="error" onClose={() => add.setError(null)}>
 {add.error}
 </Notice>
 ) : null}

 <div className="flex flex-wrap items-center gap-2">
 <Button type="submit" loading={add.isPending}>
 Добавить
 </Button>
 <p className="text-xs font-bold text-muted">Enter — добавить и продолжить.</p>
 </div>
 </form>
 );
}

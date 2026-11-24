import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPost, errorMessage } from '../lib/api';
import { MAX_GIFT_CATEGORIES } from '../lib/categories';
import { categoryDotStyle, categoryTint } from '../lib/category-colors';
import type { CategoryDTO, CategoryResponse } from '../lib/types';
import { Button } from './button';

export interface GiftCategoriesEditorProps {
 listId: string;
 /** Все категории вишлиста. */
 categories: CategoryDTO[];
 /** Выбранные категории подарка (локальное состояние модалки). */
 selectedIds: string[];
 onChange: (ids: string[]) => void;
 onError: (message: string) => void;
}

/**
 * Блок «Категории» в модалке: назначить/снять чипы и создать новую категорию.
 * Изменения копятся локально и уходят в общем PATCH при сохранении подарка.
 */
export function GiftCategoriesEditor({
 listId,
 categories,
 selectedIds,
 onChange,
 onError,
}: GiftCategoriesEditorProps) {
 const queryClient = useQueryClient();
 const [name, setName] = useState('');
 const [pending, setPending] = useState(false);
 // Созданные в этой модалке категории: показываем сразу, не дожидаясь refetch.
 const [created, setCreated] = useState<CategoryDTO[]>([]);

 const allCategories = [
 ...categories,
 ...created.filter((category) => !categories.some((item) => item.id === category.id)),
 ];
 const assigned = selectedIds
 .map((id) => allCategories.find((category) => category.id === id))
 .filter((category): category is CategoryDTO => category !== undefined);
 const available = allCategories.filter((category) => !selectedIds.includes(category.id));

 function toggle(category: CategoryDTO) {
 if (selectedIds.includes(category.id)) {
 onChange(selectedIds.filter((id) => id !== category.id));
 return;
 }
 if (selectedIds.length >= MAX_GIFT_CATEGORIES) {
 onError(`У подарка может быть не больше ${MAX_GIFT_CATEGORIES} категорий.`);
 return;
 }
 onChange([...selectedIds, category.id]);
 }

 async function createCategory() {
 const trimmed = name.trim();
 if (trimmed === '') {
 onError('Введите название категории.');
 return;
 }
 if (selectedIds.length >= MAX_GIFT_CATEGORIES) {
 onError(`У подарка может быть не больше ${MAX_GIFT_CATEGORIES} категорий.`);
 return;
 }

 setPending(true);
 try {
 const response = await apiPost<CategoryResponse>(
 `/me/wishlists/${listId}/categories`,
 { name: trimmed },
 );
 setName('');
 setCreated((current) => [...current, response.category]);
 onChange([...selectedIds, response.category.id]);
 // Новая категория должна появиться в общем списке категорий вишлиста.
 void queryClient.invalidateQueries({ queryKey: ['wishlist', listId] });
 } catch (error) {
 onError(errorMessage(error));
 } finally {
 setPending(false);
 }
 }

 return (
 <div className="rounded-xl border border-line bg-card p-3">
 <p className="text-sm font-semibold tracking-wide text-ink">Категории</p>

 {assigned.length === 0 ? (
 <p className="mt-1 text-xs text-muted">Пока без категории.</p>
 ) : (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {assigned.map((category) => {
 const tint = categoryTint(category.color);
 return (
 <button
 key={category.id}
 type="button"
 onClick={() => toggle(category)}
 aria-label={`Снять категорию «${category.name}»`}
 data-color={category.color ?? 'none'}
 style={tint}
 className={[
 'inline-flex min-h-11 items-center gap-1 rounded-full border border-ink px-2 py-0.5 text-xs font-medium active:translate-y-px',
 tint
 ? 'text-ink hover:brightness-95'
 : 'bg-card text-muted hover:bg-paper',
 ].join(' ')}
 >
 {category.color ? (
 <span
 aria-hidden="true"
 className="h-1.5 w-1.5 rounded-full"
 style={categoryDotStyle(category.color)}
 />
 ) : null}
 {category.name}
 <span aria-hidden="true">✕</span>
 </button>
 );
 })}
 </div>
 )}

 {available.length > 0 ? (
 <div className="mt-2">
 <p className="text-xs text-muted">Добавить:</p>
 <div className="mt-1 flex flex-wrap gap-1.5">
 {available.map((category) => {
 const tint = categoryTint(category.color);
 return (
 <button
 key={category.id}
 type="button"
 disabled={pending || selectedIds.length >= MAX_GIFT_CATEGORIES}
 onClick={() => toggle(category)}
 aria-label={`Добавить категорию «${category.name}»`}
 data-color={category.color ?? 'none'}
 style={tint}
 className={[
 'inline-flex min-h-11 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold',
 tint
 ? 'border-transparent text-ink hover:opacity-90'
 : 'border-ink bg-card text-muted hover:bg-paper hover:text-ink',
 'disabled:opacity-60',
 ].join(' ')}
 >
 {category.color ? (
 <span
 aria-hidden="true"
 className="h-1.5 w-1.5 rounded-full"
 style={categoryDotStyle(category.color)}
 />
 ) : null}
 ＋ {category.name}
 </button>
 );
 })}
 </div>
 </div>
 ) : null}

 <div className="mt-3 flex flex-wrap items-center gap-2">
 <input
 aria-label="Название новой категории"
 value={name}
 onChange={(event) => setName(event.target.value)}
 onKeyDown={(event) => {
 if (event.key === 'Enter') {
 event.preventDefault();
 void createCategory();
 }
 }}
 maxLength={40}
 placeholder="＋ Новая категория"
 className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink bg-card px-3 text-base text-ink placeholder:text-muted/70 focus:outline-none md:text-sm"
 />
 <Button
 type="button"
 size="sm"
 loading={pending}
 disabled={selectedIds.length >= MAX_GIFT_CATEGORIES}
 onClick={() => void createCategory()}
 >
 Создать
 </Button>
 </div>

 {allCategories.length === 0 ? (
 <p className="mt-2 text-xs text-muted">В списке пока нет категорий — создайте первую.</p>
 ) : null}
 </div>
 );
}

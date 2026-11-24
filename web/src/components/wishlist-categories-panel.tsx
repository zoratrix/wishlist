import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost, errorMessage } from '../lib/api';
import type { CategoryFilter } from '../lib/categories';
import type { CategoryDTO } from '../lib/types';
import { Button } from './button';
import { CategoryColorPicker } from './category-color-picker';
import { CategoryFilter as CategoryFilterChips } from './category-filter';
import { ConfirmDialog } from './confirm-dialog';
import { Notice } from './notice';

export interface WishlistCategoriesPanelProps {
 listId: string;
 categories: CategoryDTO[];
 filter: CategoryFilter;
 onFilterChange: (value: CategoryFilter) => void;
}

interface PanelNotice {
 kind: 'success' | 'error';
 text: string;
}

const inlineInput = [
 'min-h-11 min-w-0 flex-1 rounded-lg border border-ink bg-card px-3 text-base text-ink',
 ' placeholder:text-muted ',
 'focus:outline-none md:text-sm',
].join(' ');

const iconButton = [
 'nb-focus flex h-11 w-11 shrink-0 items-center justify-center',
 'rounded-xl border border-ink bg-card text-base font-medium text-ink transition-colors hover:border-ink focus:outline-none',
].join(' ');

/**
 * Единая панель категорий в редакторе: фильтр-чипы + добавление категории
 * + режим «Изменить/Готово» с переименованием и удалением.
 */
export function WishlistCategoriesPanel({
 listId,
 categories,
 filter,
 onFilterChange,
}: WishlistCategoriesPanelProps) {
 const queryClient = useQueryClient();
 const [isEditing, setIsEditing] = useState(false);
 const [isAdding, setIsAdding] = useState(false);
 const [newName, setNewName] = useState('');
 const [newColor, setNewColor] = useState<string | null>(null);
 const [renamingId, setRenamingId] = useState<string | null>(null);
 const [renameDraft, setRenameDraft] = useState('');
 const [confirming, setConfirming] = useState<CategoryDTO | null>(null);
 const [pending, setPending] = useState(false);
 const [notice, setNotice] = useState<PanelNotice | null>(null);

 function refresh() {
 void queryClient.invalidateQueries({ queryKey: ['wishlist', listId] });
 }

 async function createCategory() {
 const name = newName.trim();
 if (name === '') {
 setNotice({ kind: 'error', text: 'Введите название категории.' });
 return;
 }
 setPending(true);
 try {
 await apiPost(`/me/wishlists/${listId}/categories`, { name, color: newColor });
 setNewName('');
 setNewColor(null);
 setIsAdding(false);
 setNotice({ kind: 'success', text: 'Категория добавлена.' });
 refresh();
 } catch (error) {
 setNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setPending(false);
 }
 }

 function handleCreate(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 void createCategory();
 }

 function startRename(category: CategoryDTO) {
 setRenamingId(category.id);
 setRenameDraft(category.name);
 setNotice(null);
 }

 async function renameCategory(category: CategoryDTO) {
 const name = renameDraft.trim();
 if (name === '') {
 setNotice({ kind: 'error', text: 'Название категории не может быть пустым.' });
 return;
 }
 if (name === category.name) {
 setRenamingId(null);
 return;
 }
 setPending(true);
 try {
 await apiPatch(`/me/categories/${category.id}`, { name });
 setRenamingId(null);
 setNotice({ kind: 'success', text: 'Категория переименована.' });
 refresh();
 } catch (error) {
 setNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setPending(false);
 }
 }

 async function changeColor(category: CategoryDTO, color: string | null) {
 if (category.color === color) {
 return;
 }
 setPending(true);
 try {
 await apiPatch(`/me/categories/${category.id}`, { color });
 setNotice({ kind: 'success', text: 'Цвет категории изменён.' });
 refresh();
 } catch (error) {
 setNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setPending(false);
 }
 }

 async function deleteCategory() {
 const category = confirming;
 if (!category) {
 return;
 }
 setPending(true);
 try {
 await apiDelete(`/me/categories/${category.id}`);
 setConfirming(null);
 setNotice({ kind: 'success', text: 'Категория удалена. Подарки остались, теги сняты.' });
 refresh();
 } catch (error) {
 setConfirming(null);
 setNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setPending(false);
 }
 }

 return (
 <section className="mt-6 rounded-2xl border border-ink bg-card p-4">
 <div className="flex flex-wrap items-center gap-2">
 <CategoryFilterChips categories={categories} value={filter} onChange={onFilterChange} />
 <div className="ml-auto flex flex-wrap items-center gap-2">
 {categories.length > 0 ? (
 <Button
 variant="secondary"
 size="sm"
 aria-pressed={isEditing}
 onClick={() => setIsEditing((value) => !value)}
 >
 {isEditing ? 'Готово' : 'Изменить'}
 </Button>
 ) : null}
 <Button size="sm" aria-expanded={isAdding} onClick={() => setIsAdding(true)}>
 ＋ Категория
 </Button>
 </div>
 </div>

 {categories.length === 0 ? (
 <p className="mt-2 text-xs font-medium text-muted">
 Добавьте категории, чтобы группировать подарки.
 </p>
 ) : null}

 {notice ? (
 <div className="mt-3">
 <Notice kind={notice.kind} onClose={() => setNotice(null)}>
 {notice.text}
 </Notice>
 </div>
 ) : null}

 {isAdding ? (
 <form
 className="mt-3 rounded-lg border border-line bg-card p-3"
 onSubmit={handleCreate}
 noValidate
 >
 <div className="flex flex-wrap items-center gap-2">
 <input
 aria-label="Название новой категории списка"
 autoFocus
 value={newName}
 maxLength={40}
 placeholder="Новая категория"
 onChange={(event) => setNewName(event.target.value)}
 onKeyDown={(event) => {
 if (event.key === 'Enter') {
 event.preventDefault();
 void createCategory();
 } else if (event.key === 'Escape') {
 event.preventDefault();
 setIsAdding(false);
 setNewName('');
 setNewColor(null);
 }
 }}
 className={inlineInput}
 />
 <Button type="submit" size="sm" loading={pending}>
 Добавить
 </Button>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 setIsAdding(false);
 setNewName('');
 setNewColor(null);
 }}
 >
 Отмена
 </Button>
 </div>
 <div className="mt-3">
 <CategoryColorPicker
 value={newColor}
 onChange={setNewColor}
 disabled={pending}
 namePrefix="новой категории"
 />
 </div>
 </form>
 ) : null}

 {isEditing ? (
 <ul className="mt-3 space-y-2">
 {categories.map((category) => (
 <li key={category.id} className="rounded-lg border border-line bg-card p-2">
 <div className="flex flex-wrap items-center gap-1.5">
 {renamingId === category.id ? (
 <input
 aria-label={`Новое название категории «${category.name}»`}
 autoFocus
 value={renameDraft}
 maxLength={40}
 onChange={(event) => setRenameDraft(event.target.value)}
 onBlur={() => {
 if (!pending) {
 setRenamingId(null);
 }
 }}
 onKeyDown={(event) => {
 if (event.key === 'Enter') {
 event.preventDefault();
 void renameCategory(category);
 } else if (event.key === 'Escape') {
 event.preventDefault();
 setRenamingId(null);
 }
 }}
 className={[inlineInput, 'border-accent '].join(
 ' ',
 )}
 />
 ) : (
 <>
 <span className="min-w-0 flex-1 truncate px-1 text-sm font-bold text-ink">
 {category.name}
 </span>
 <button
 type="button"
 aria-label={`Переименовать категорию «${category.name}»`}
 onClick={() => startRename(category)}
 className={[iconButton, 'hover:bg-accent-soft'].join(' ')}
 >
 <span aria-hidden="true">✎</span>
 </button>
 <button
 type="button"
 aria-label={`Удалить категорию «${category.name}»`}
 onClick={() => setConfirming(category)}
 className={[iconButton, 'hover:bg-powder-soft'].join(' ')}
 >
 <span aria-hidden="true">×</span>
 </button>
 </>
 )}
 </div>
 <div className="mt-2">
 <CategoryColorPicker
 value={category.color}
 onChange={(color) => void changeColor(category, color)}
 disabled={pending}
 namePrefix={`категории «${category.name}»`}
 />
 </div>
 </li>
 ))}
 </ul>
 ) : null}

 <ConfirmDialog
 open={confirming !== null}
 title="Удалить категорию?"
 message={`«${confirming?.name ?? ''}» — подарки останутся, теги снимутся.`}
 pending={pending}
 onCancel={() => setConfirming(null)}
 onConfirm={() => void deleteCategory()}
 />
 </section>
 );
}

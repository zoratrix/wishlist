import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiPatch, apiPost, errorMessage } from '../lib/api';
import type { CategoryDTO, GiftDTO, GiftStatus } from '../lib/types';
import { parsePriceMinor, priceMinorToInput, priorityMeta } from '../lib/format';
import { normalizeLinks, validateLinks } from '../lib/links';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { CheckboxField, SelectField, TextAreaField, TextField } from './field';
import { GiftCategoriesEditor } from './gift-categories-editor';
import { GiftLinks } from './gift-links';
import { LinksEditor } from './links-editor';
import { Modal } from './modal';
import { Notice } from './notice';

export interface GiftEditModalProps {
 listId: string;
 gift: GiftDTO;
 index: number;
 total: number;
 gifts: GiftDTO[];
 /** Все категории вишлиста. */
 categories: CategoryDTO[];
 /** Перестановка ↑/↓ доступна только в ручном порядке «По порядку». */
 showReorder?: boolean;
 onClose: () => void;
 /** Сохранено: страница закрывает модалку и показывает «Сохранено». */
 onSaved: () => void;
 /** Удалено: страница закрывает модалку и показывает сообщение. */
 onDeleted: () => void;
}

const PRIORITY_OPTIONS = [1, 2, 3, 4, 5].map((value) => priorityMeta(value));

/** Модальное окно полного редактирования подарка. */
export function GiftEditModal({
 listId,
 gift,
 index,
 total,
 gifts,
 categories,
 showReorder = true,
 onClose,
 onSaved,
 onDeleted,
}: GiftEditModalProps) {
 const queryClient = useQueryClient();
 const [title, setTitle] = useState(gift.title);
 const [description, setDescription] = useState(gift.description ?? '');
 const [links, setLinks] = useState<string[]>(gift.links.length > 0 ? [...gift.links] : ['']);
 const [price, setPrice] = useState(priceMinorToInput(gift.priceMinor));
 const [priority, setPriority] = useState(String(gift.priority));
 const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
 (gift.categories ?? []).map((category) => category.id),
 );
 const [status, setStatus] = useState<GiftStatus>(gift.status);
 const [formError, setFormError] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [reordering, setReordering] = useState(false);
 const [confirmingDelete, setConfirmingDelete] = useState(false);
 const titleRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 titleRef.current?.focus();
 titleRef.current?.select();
 }, []);

 function refresh() {
 void queryClient.invalidateQueries({ queryKey: ['wishlist', listId] });
 void queryClient.invalidateQueries({ queryKey: ['wishlists'] });
 }

 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFormError(null);

 const trimmedTitle = title.trim();
 if (trimmedTitle === '') {
 setFormError('Введите название подарка.');
 return;
 }

 let priceMinor: number | null;
 try {
 priceMinor = parsePriceMinor(price);
 } catch (error) {
 setFormError(errorMessage(error));
 return;
 }

 const linksError = validateLinks(links);
 if (linksError !== null) {
 setFormError(linksError);
 return;
 }

 const nextDescription = description.trim() === '' ? null : description.trim();
 const nextLinks = normalizeLinks(links);
 const originalCategoryIds = (gift.categories ?? []).map((category) => category.id);

 // PATCH только изменённых полей.
 const patch: Record<string, unknown> = {};
 if (trimmedTitle !== gift.title) {
 patch.title = trimmedTitle;
 }
 if (nextDescription !== gift.description) {
 patch.description = nextDescription;
 }
 if (priceMinor !== gift.priceMinor) {
 patch.priceMinor = priceMinor;
 }
 if (Number(priority) !== gift.priority) {
 patch.priority = Number(priority);
 }
 if (JSON.stringify(nextLinks) !== JSON.stringify(gift.links)) {
 patch.links = nextLinks;
 }
 if (
 JSON.stringify([...selectedCategoryIds].sort()) !==
 JSON.stringify([...originalCategoryIds].sort())
 ) {
 patch.categoryIds = selectedCategoryIds;
 }

 const statusChanged = status !== gift.status;
 if (Object.keys(patch).length === 0 && !statusChanged) {
 onClose();
 return;
 }

 setSaving(true);
 try {
 if (Object.keys(patch).length > 0) {
 await apiPatch(`/me/gifts/${gift.id}`, patch);
 }
 if (statusChanged) {
 await apiPost(`/me/gifts/${gift.id}/status`, { status });
 }
 refresh();
 onSaved();
 } catch (error) {
 setFormError(errorMessage(error));
 } finally {
 setSaving(false);
 }
 }

 async function move(direction: -1 | 1) {
 const targetIndex = index + direction;
 if (targetIndex < 0 || targetIndex >= gifts.length) {
 return;
 }
 const order = gifts.map((item) => item.id);
 const currentId = order[index];
 const targetId = order[targetIndex];
 if (!currentId || !targetId) {
 return;
 }
 order[index] = targetId;
 order[targetIndex] = currentId;

 setReordering(true);
 setFormError(null);
 try {
 await apiPost<void>(`/me/wishlists/${listId}/gifts/reorder`, { order });
 refresh();
 } catch (error) {
 setFormError(errorMessage(error));
 } finally {
 setReordering(false);
 }
 }

 async function handleDelete() {
 setDeleting(true);
 setFormError(null);
 try {
 await apiDelete(`/me/gifts/${gift.id}`);
 refresh();
 setConfirmingDelete(false);
 onDeleted();
 } catch (error) {
 setConfirmingDelete(false);
 setFormError(errorMessage(error));
 } finally {
 setDeleting(false);
 }
 }

 return (
 <>
 <Modal
 open
 title="Редактировать подарок"
 size="lg"
 onClose={onClose}
 headerActions={
 showReorder ? (
 <>
 <button
 type="button"
 aria-label="Переместить выше"
 title="Выше"
 disabled={index === 0 || reordering}
 onClick={() => void move(-1)}
 className={[
 'nb-focus flex h-11 w-11 items-center justify-center rounded-lg border border-line',
 'bg-card text-lg font-semibold text-ink transition-colors',
 'hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40',
 ].join(' ')}
 >
 ↑
 </button>
 <button
 type="button"
 aria-label="Переместить ниже"
 title="Ниже"
 disabled={index === total - 1 || reordering}
 onClick={() => void move(1)}
 className={[
 'nb-focus flex h-11 w-11 items-center justify-center rounded-lg border border-line',
 'bg-card text-lg font-semibold text-ink transition-colors',
 'hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40',
 ].join(' ')}
 >
 ↓
 </button>
 </>
 ) : null
 }
 >
 <div className="space-y-2">
 {formError ? (
 <Notice kind="error" onClose={() => setFormError(null)}>
 {formError}
 </Notice>
 ) : null}
 </div>

 {gift.links.length > 0 ? (
 <div className="mt-3">
 <GiftLinks links={gift.links} variant="card" />
 </div>
 ) : null}

 <form className="mt-3 space-y-3" onSubmit={handleSubmit} noValidate>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <TextField
 className="sm:col-span-2"
 label="Название"
 inputRef={titleRef}
 value={title}
 maxLength={200}
 onChange={(event) => setTitle(event.target.value)}
 />

 <TextAreaField
 className="sm:col-span-2"
 label="Описание"
 rows={3}
 maxLength={2000}
 value={description}
 placeholder="Цвет, размер, где посмотреть… (необязательно)"
 onChange={(event) => setDescription(event.target.value)}
 />

 <TextField
 label="Цена, ₽"
 type="number"
 inputMode="decimal"
 min="0"
 step="0.01"
 value={price}
 onChange={(event) => setPrice(event.target.value)}
 />

 <SelectField
 label="Приоритет"
 value={priority}
 onChange={(event) => setPriority(event.target.value)}
 >
 {PRIORITY_OPTIONS.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </SelectField>

 <div className="sm:col-span-2">
 <LinksEditor
 links={links}
 onChange={setLinks}
 labelPrefix={`Подарка «${gift.title}»: `}
 />
 </div>

 <div className="sm:col-span-2">
 <GiftCategoriesEditor
 listId={listId}
 categories={categories}
 selectedIds={selectedCategoryIds}
 onChange={setSelectedCategoryIds}
 onError={setFormError}
 />
 </div>

 <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
 <CheckboxField
 label="Уже подарен"
 checked={status === 'gifted'}
 onChange={(checked) => setStatus(checked ? 'gifted' : 'available')}
 />
 {gift.booking ? (
 <p className="nb-badge min-w-0 bg-lavender-soft px-2 py-1 text-xs font-bold text-ink">
 Забронировано
 {gift.booking.bookerName ? ` — ${gift.booking.bookerName}` : ''}
 </p>
 ) : null}
 </div>

 {showReorder ? null : (
 <p className="text-xs font-semibold text-muted sm:col-span-2">
 Перестановка доступна в режиме «По порядку».
 </p>
 )}
 </div>

 <div className="flex flex-wrap gap-2 border-t border-line pt-3">
 <Button type="submit" loading={saving}>
 Сохранить
 </Button>
 <Button
 variant="danger"
 onClick={() => setConfirmingDelete(true)}
 disabled={deleting}
 >
 Удалить
 </Button>
 <Button variant="secondary" onClick={onClose}>
 Отмена
 </Button>
 </div>
 </form>
 </Modal>

 <ConfirmDialog
 open={confirmingDelete}
 title="Удалить подарок?"
 message={`«${gift.title}» исчезнет из списка. Это действие нельзя отменить.`}
 pending={deleting}
 onCancel={() => setConfirmingDelete(false)}
 onConfirm={() => void handleDelete()}
 />
 </>
 );
}

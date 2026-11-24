import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, ApiError, errorMessage } from '../lib/api';
import type {
 Visibility,
 WishlistDetailResponse,
 WishlistResponse,
 WishlistSummaryDTO,
} from '../lib/types';
import { visibilityHint, visibilityLabel } from '../lib/format';
import { Button } from '../components/button';
import { CheckboxField, TextAreaField, TextField } from '../components/field';
import { ConfirmDialog } from '../components/confirm-dialog';
import { Notice } from '../components/notice';
import { WishlistDesignFields } from '../components/wishlist-design-fields';
import { ErrorBlock, LoadingBlock } from '../components/states';

function VisibilityChoice({
 value,
 current,
 onSelect,
}: {
 value: VisibilityOption;
 current: VisibilityOption;
 onSelect: (value: VisibilityOption) => void;
}) {
 return (
 <label
 className={[
 'nb-focus flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3 transition-colors',
 current === value ? 'bg-accent-soft' : 'bg-card hover:bg-paper',
 ].join(' ')}
 >
 <input
 type="radio"
 name="visibility"
 value={value}
 checked={current === value}
 onChange={() => onSelect(value)}
 className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
 />
 <span className="min-w-0">
 <span className="block text-sm font-bold text-ink">{visibilityLabel(value)}</span>
 <span className="mt-0.5 block text-xs font-medium text-muted">{visibilityHint(value)}</span>
 </span>
 </label>
 );
}

/** Варианты видимости: публичный, по ссылке, только подписчикам. */
type VisibilityOption = Visibility;

function SettingsForm({ wishlist }: { wishlist: WishlistSummaryDTO }) {
 const navigate = useNavigate();
 const queryClient = useQueryClient();

 const [title, setTitle] = useState(wishlist.title);
 const [description, setDescription] = useState(wishlist.description ?? '');
 const [eventDate, setEventDate] = useState(wishlist.eventDate ?? '');
 const [visibility, setVisibility] = useState<VisibilityOption>(wishlist.visibility);
 const [showBooked, setShowBooked] = useState(wishlist.showBooked);
 const [showBookerNames, setShowBookerNames] = useState(wishlist.showBookerNames);
 const [themeColor, setThemeColor] = useState<string | null>(wishlist.themeColor ?? null);
 const [themeEmoji, setThemeEmoji] = useState<string | null>(wishlist.themeEmoji ?? null);
 const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
 const [titleError, setTitleError] = useState<string | null>(null);
 const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

 // Снимок сохранённых значений: по нему показываем, есть ли несохранённые изменения.
 const initialValues = useMemo(
 () => ({
 title: wishlist.title,
 description: wishlist.description ?? '',
 eventDate: wishlist.eventDate ?? '',
 visibility: wishlist.visibility,
 showBooked: wishlist.showBooked,
 showBookerNames: wishlist.showBookerNames,
 themeColor: wishlist.themeColor ?? null,
 themeEmoji: wishlist.themeEmoji ?? null,
 }),
 [wishlist],
 );
 const isDirty =
 title.trim() !== initialValues.title ||
 description !== initialValues.description ||
 eventDate !== initialValues.eventDate ||
 visibility !== initialValues.visibility ||
 showBooked !== initialValues.showBooked ||
 showBookerNames !== initialValues.showBookerNames ||
 themeColor !== initialValues.themeColor ||
 themeEmoji !== initialValues.themeEmoji;

 useEffect(() => {
 if (!isDirty) return undefined;
 function handleBeforeUnload(event: BeforeUnloadEvent) {
 event.preventDefault();
 event.returnValue = '';
 }
 window.addEventListener('beforeunload', handleBeforeUnload);
 return () => window.removeEventListener('beforeunload', handleBeforeUnload);
 }, [isDirty]);

 const saveMutation = useMutation<WishlistResponse, ApiError, void>({
 mutationFn: () =>
 apiPatch<WishlistResponse>(`/me/wishlists/${wishlist.id}`, {
 title: title.trim(),
 description: description.trim() === '' ? null : description.trim(),
 eventDate: eventDate === '' ? null : eventDate,
 visibility,
 themeColor,
 themeEmoji,
 showBooked,
 showBookerNames: showBooked ? showBookerNames : false,
 }),
 onSuccess: (data) => {
 setNotice({ kind: 'success', text: 'Настройки сохранены.' });
 setThemeColor(data.wishlist.themeColor ?? null);
 setThemeEmoji(data.wishlist.themeEmoji ?? null);
 void queryClient.invalidateQueries({ queryKey: ['wishlist', wishlist.id] });
 void queryClient.invalidateQueries({ queryKey: ['wishlists'] });
 },
 onError: (error) => setNotice({ kind: 'error', text: errorMessage(error) }),
 });

 const deleteMutation = useMutation<void, ApiError, void>({
 mutationFn: () => apiDelete(`/me/wishlists/${wishlist.id}`),
 onSuccess: () => {
 void queryClient.invalidateQueries({ queryKey: ['wishlists'] });
 navigate('/app/profile', { replace: true });
 },
 onError: (error) => {
 setIsConfirmingDelete(false);
 setNotice({ kind: 'error', text: errorMessage(error) });
 },
 });

 function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setNotice(null);
 if (title.trim() === '') {
 setTitleError('Введите название списка.');
 return;
 }
 setTitleError(null);
 saveMutation.mutate();
 }

 const visibilityOptions: VisibilityOption[] = ['public', 'link', 'followers'];

 return (
 <div>
 <Link
 to={`/app/lists/${wishlist.id}`}
 onClick={(event) => {
 if (isDirty && !window.confirm('Есть несохранённые изменения. Уйти без сохранения?')) {
 event.preventDefault();
 }
 }}
 className="inline-flex min-h-11 items-center text-sm font-bold text-ink hover:underline hover:decoration-2 hover:underline-offset-2"
 >
 ← К списку
 </Link>

 <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">Настройки списка</h1>
 <p className="mt-1 text-sm font-medium text-muted">Название, дата, видимость и показ броней.</p>

 <form
 className="mt-6 space-y-5 rounded-2xl border border-line bg-card p-4 md:p-6"
 onSubmit={handleSubmit}
 noValidate
 >
 <TextField
 label="Название"
 value={title}
 maxLength={100}
 onChange={(event) => setTitle(event.target.value)}
 error={titleError}
 />

 <TextAreaField
 label="Описание"
 value={description}
 rows={3}
 maxLength={2000}
 onChange={(event) => setDescription(event.target.value)}
 placeholder="Повод, пожелания, что важно знать гостям"
 />

 <TextField
 label="Дата события"
 type="date"
 value={eventDate}
 onChange={(event) => setEventDate(event.target.value)}
 />

 <fieldset className="rounded-xl border border-line bg-card p-3">
 <legend className="px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
 Кто увидит список
 </legend>
 <div className="mt-2 space-y-2">
 {visibilityOptions.map((option) => (
 <VisibilityChoice
 key={option}
 value={option}
 current={visibility}
 onSelect={setVisibility}
 />
 ))}
 </div>
 </fieldset>

 <WishlistDesignFields
 listId={wishlist.id}
 themeColor={themeColor}
 onThemeChange={setThemeColor}
 themeEmoji={themeEmoji}
 onEmojiChange={setThemeEmoji}
 initialCoverPath={wishlist.coverPath}
 onNotice={setNotice}
 />

 <fieldset className="rounded-xl border border-line bg-card p-3">
 <legend className="px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
 Брони
 </legend>
 <div className="space-y-3">
 <CheckboxField
 label="Показывать забронированные подарки"
 hint="Если выключено, вы не увидите, что уже выбрали гости."
 checked={showBooked}
 onChange={(checked) => {
 setShowBooked(checked);
 if (!checked) {
 setShowBookerNames(false);
 }
 }}
 />
 <CheckboxField
 label="Показывать, кто забронировал"
 hint="Имя гостя, который оставил бронь. Email не показывается никогда."
 checked={showBookerNames}
 disabled={!showBooked}
 onChange={setShowBookerNames}
 />
 </div>
 </fieldset>

 {isDirty ? (
 <p className="inline-flex rounded-lg border border-line bg-butter-soft px-3 py-2 text-sm font-bold text-ink">
 Есть несохранённые изменения.
 </p>
 ) : null}
 {notice ? (
 <Notice kind={notice.kind} onClose={() => setNotice(null)}>
 {notice.text}
 </Notice>
 ) : null}
 <Button type="submit" className="w-full" loading={saveMutation.isPending}>
 Сохранить настройки
 </Button>
 </form>

 <section className="mt-8 rounded-2xl border border-line bg-powder-soft p-4">
 <h2 className="text-base font-semibold tracking-tight text-ink">Удаление списка</h2>
 <p className="mt-1 text-sm font-medium text-ink">
 Список и все подарки исчезнут. Гости по ссылке увидят «Страница не найдена».
 </p>
 <Button
 variant="danger"
 className="mt-3"
 onClick={() => setIsConfirmingDelete(true)}
 disabled={deleteMutation.isPending}
 >
 Удалить список
 </Button>
 </section>

 <ConfirmDialog
 open={isConfirmingDelete}
 title="Удалить вишлист?"
 message={`«${wishlist.title}» и все подарки в нём будут удалены. Это действие нельзя отменить.`}
 confirmLabel="Удалить"
 pending={deleteMutation.isPending}
 onCancel={() => setIsConfirmingDelete(false)}
 onConfirm={() => deleteMutation.mutate()}
 />
 </div>
 );
}

export default function ListSettingsPage() {
 const { id = '' } = useParams<{ id: string }>();

 const query = useQuery<WishlistDetailResponse, ApiError>({
 queryKey: ['wishlist', id],
 queryFn: () => apiGet<WishlistDetailResponse>(`/me/wishlists/${encodeURIComponent(id)}`),
 enabled: id !== '',
 });

 if (query.isPending) {
 return (
 <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-6">
 <LoadingBlock rows={4} />
 </div>
 );
 }

 if (query.isError) {
 return (
 <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 md:px-6">
 <Link
 to="/app/profile"
 className="inline-flex min-h-11 items-center text-sm font-bold text-ink hover:underline hover:decoration-2 hover:underline-offset-2"
 >
 ← Мои вишлисты
 </Link>
 <ErrorBlock
 message={query.error.message}
 onRetry={() => {
 void query.refetch();
 }}
 />
 </div>
 );
 }

 return (
 <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-6">
 <SettingsForm key={query.data.wishlist.id} wishlist={query.data.wishlist} />
 </div>
 );
}

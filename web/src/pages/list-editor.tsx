import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, ApiError, errorMessage } from '../lib/api';
import type { GiftDTO, GiftResponse, WishlistDetailResponse } from '../lib/types';
import { copyText } from '../lib/copy';
import {
 formatDate,
 giftsCountLabel,
 parsePriceMinor,
 priceMinorToInput,
 visibilityLabel,
} from '../lib/format';
import { useMediaQuery } from '../hooks/use-media-query';
import { useViewMode } from '../hooks/use-view-mode';
import {
 filterGifts,
 resolveCategoryFilter,
 type CategoryFilter,
} from '../lib/categories';
import { isAvailabilitySort, sortGifts } from '../lib/sort';
import { useGiftSort } from '../hooks/use-gift-sort';
import { AddGiftPanel } from '../components/add-gift-panel';
import { AddGiftTableRows } from '../components/add-gift-table-rows';
import { Button, buttonClasses } from '../components/button';
import { GiftPrice } from '../components/gift-badges';
import type { GiftStatusView } from '../components/gift-badges';
import { GiftViews } from '../components/gift-views';
import type { GiftCellRenderers, GiftViewAdapter } from '../components/gift-views';
import { InlineDescriptionCell } from '../components/inline-description-cell';
import { InlinePriorityCell } from '../components/inline-priority-cell';
import { InlineTextCell } from '../components/inline-text-cell';
import { Notice } from '../components/notice';
import { ConfirmDialog } from '../components/confirm-dialog';
import { LinkifiedText } from '../components/linkified-text';
import { SortSelect } from '../components/sort-select';
import { ViewModeSwitch } from '../components/view-mode-switch';
import { WishlistCategoriesPanel } from '../components/wishlist-categories-panel';
import { WishlistHero } from '../components/wishlist-hero';
import { WishlistTheme } from '../components/wishlist-theme';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/states';
import { EditGiftIconButton } from '../components/edit-gift-icon-button';
import { GiftEditModal } from '../components/gift-edit-modal';

interface ShareNotice {
 kind: 'success' | 'info';
 url: string;
}

type GiftPatch = Partial<Pick<GiftDTO, 'title' | 'description' | 'priceMinor' | 'priority'>>;

function ownerStatus(gift: GiftDTO): GiftStatusView {
 if (gift.status === 'gifted') {
 return { label: 'Подарен', tone: 'gifted' };
 }
 if (gift.booking !== null) {
 return { label: 'Забронировано', tone: 'booked' };
 }
 return { label: 'Свободен', tone: 'free' };
}

export default function ListEditorPage() {
 const { id = '' } = useParams<{ id: string }>();
 const queryClient = useQueryClient();
 const isWide = useMediaQuery('(min-width: 768px)');
 const [view, setView] = useViewMode();
 const [sort, setSort] = useGiftSort();
 const [shareNotice, setShareNotice] = useState<ShareNotice | null>(null);
 const [confirmShorten, setConfirmShorten] = useState(false);
 const [shortenError, setShortenError] = useState<string | null>(null);
 const [inlineError, setInlineError] = useState<string | null>(null);
 const [savedNotice, setSavedNotice] = useState<string | null>(null);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

 const query = useQuery<WishlistDetailResponse, ApiError>({
 queryKey: ['wishlist', id],
 queryFn: () => apiGet<WishlistDetailResponse>(`/me/wishlists/${encodeURIComponent(id)}`),
 enabled: id !== '',
 });

 if (query.isPending) {
 return (
 <div className="mx-auto w-full max-w-[1440px] space-y-4 px-4 pt-4 md:px-6 lg:px-8">
 <div className="h-8 w-2/3 animate-pulse rounded-lg bg-ink/15" />
 <LoadingBlock rows={4} />
 </div>
 );
 }

 if (query.isError) {
 return (
 <div className="mx-auto w-full max-w-[1440px] space-y-4 px-4 pt-4 md:px-6 lg:px-8">
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

 const { wishlist, gifts } = query.data;
 const categories = query.data.categories ?? [];
 const activeFilter = resolveCategoryFilter(categoryFilter, categories);
 // Владелец при showBooked=false не видит броней — сортировка по занятости скрыта.
 const hideAvailability = wishlist.showBooked === false;
 const effectiveSort = hideAvailability && isAvailabilitySort(sort) ? 'order' : sort;
 const visibleGifts = sortGifts(filterGifts(gifts, activeFilter), effectiveSort);
 const shareUrl = `${window.location.origin}/w/${wishlist.shareToken}`;
 const meta = [formatDate(wishlist.eventDate), giftsCountLabel(gifts.length)]
 .filter(Boolean)
 .join(' · ');

 const editingGift = editingId === null ? null : (gifts.find((gift) => gift.id === editingId) ?? null);

 async function handleShare() {
 const copied = await copyText(shareUrl);
 // Если буфер недоступен (старый браузер, запрет политики) — показываем адрес,
 // чтобы его можно было выделить и скопировать вручную.
 setShareNotice({ kind: copied ? 'success' : 'info', url: shareUrl });
 }

 /** Перевыпуск короткой ссылки: старая перестаёт работать. */
 async function handleShortenLink() {
 try {
 const response = await apiPost<{ wishlist: { shareToken: string } }>(
 `/me/wishlists/${wishlist.id}/share-token`,
 );
 const url = `${window.location.origin}/w/${response.wishlist.shareToken}`;
 const copied = await copyText(url);
 setShortenError(null);
 setShareNotice({ kind: copied ? 'success' : 'info', url });
 await queryClient.invalidateQueries({ queryKey: ['wishlist', id] });
 } catch (error) {
 setShortenError(errorMessage(error));
 } finally {
 setConfirmShorten(false);
 }
 }

 /** Правка одного поля прямо в ячейке: PATCH + обновление списка. */
 async function patchGift(gift: GiftDTO, patch: GiftPatch): Promise<void> {
 await apiPatch<GiftResponse>(`/me/gifts/${gift.id}`, patch);
 await Promise.all([
 queryClient.invalidateQueries({ queryKey: ['wishlist', id] }),
 queryClient.invalidateQueries({ queryKey: ['wishlists'] }),
 ]);
 }

 const cells: GiftCellRenderers = {
 renderTitle: (gift) => (
 <InlineTextCell
 ariaLabel="Название подарка"
 value={gift.title}
 display={<span className="text-sm font-bold text-ink">{gift.title}</span>}
 maxLength={200}
 validate={(next) => (next.trim() === '' ? 'Название не может быть пустым.' : null)}
 onInvalid={setInlineError}
 onSave={(next) => patchGift(gift, { title: next.trim() })}
 />
 ),
 renderDescription: (gift) => (
 <InlineDescriptionCell
 description={gift.description}
 onInvalid={setInlineError}
 onSave={(description) => patchGift(gift, { description })}
 />
 ),
 renderPriority: (gift) => (
 <InlinePriorityCell
 priority={gift.priority}
 onInvalid={setInlineError}
 onSave={(priority) => patchGift(gift, { priority })}
 />
 ),
 renderPrice: (gift) => (
 <InlineTextCell
 ariaLabel="Цена подарка"
 value={priceMinorToInput(gift.priceMinor)}
 display={
 gift.priceMinor === null ? (
 <span className="text-sm font-bold text-muted">—</span>
 ) : (
 <GiftPrice priceMinor={gift.priceMinor} />
 )
 }
 inputMode="decimal"
 placeholder="₽"
 onSave={(next) => patchGift(gift, { priceMinor: parsePriceMinor(next) })}
 />
 ),
 };

 const adapter: GiftViewAdapter = {
 getStatus: ownerStatus,
 renderActions: (gift) => (
 <EditGiftIconButton onClick={() => setEditingId(gift.id)} />
 ),
 cells,
 addRows: <AddGiftTableRows listId={wishlist.id} categories={categories} />,
 };

 const hasInlineAddRow = isWide && view === 'table' && gifts.length > 0;

 return (
 <WishlistTheme
 themeColor={wishlist.themeColor}
 themeEmoji={wishlist.themeEmoji ?? null}
 seed={`${wishlist.id}:${wishlist.updatedAt}`}
 className="mx-auto w-full max-w-[1440px] px-4 pt-4 md:px-6 lg:px-8"
 >
 <Link
 to="/app/profile"
 className="inline-flex min-h-11 items-center text-sm font-bold text-ink hover:underline hover:decoration-2 hover:underline-offset-2"
 >
 ← Мои вишлисты
 </Link>

 <WishlistHero
 coverPath={wishlist.coverPath}
 themeColor={wishlist.themeColor}
 className="mt-2"
 >
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <h1 className="break-words text-2xl font-semibold leading-tight text-ink sm:text-3xl">
 {wishlist.title}
 </h1>
 <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
 {meta} · {visibilityLabel(wishlist.visibility)}
 </p>
 {wishlist.description ? (
 <LinkifiedText
 text={wishlist.description}
 className="mt-2 break-words text-sm font-medium text-muted"
 />
 ) : null}
 </div>
 <div className="flex flex-wrap gap-2">
 {wishlist.shareToken.length > 7 ? (
 <Button variant="secondary" size="sm" onClick={() => setConfirmShorten(true)}>
 Сократить ссылку
 </Button>
 ) : null}
 <Button variant="secondary" size="sm" onClick={() => void handleShare()}>
 Поделиться
 </Button>
 <Link
 to={`/app/lists/${wishlist.id}/settings`}
 className={buttonClasses('secondary', 'sm')}
 >
 Настройки
 </Link>
 </div>
 </div>
 </WishlistHero>

 {shortenError ? (
 <div className="mt-3">
 <Notice kind="error" onClose={() => setShortenError(null)}>
 {shortenError}
 </Notice>
 </div>
 ) : null}

 <ConfirmDialog
 open={confirmShorten}
 title="Сократить ссылку?"
 message="Ссылка станет короткой, но прежняя перестанет работать. Если вы уже кому-то её отправляли — отправьте новую."
 confirmLabel="Сократить"
 onConfirm={() => void handleShortenLink()}
 onCancel={() => setConfirmShorten(false)}
 />

 {shareNotice ? (
 <div className="mt-3">
 <Notice kind={shareNotice.kind} onClose={() => setShareNotice(null)}>
 {shareNotice.kind === 'success' ? 'Ссылка скопирована. ' : 'Скопируйте ссылку вручную: '}
 <span className="break-all">{shareNotice.url}</span>
 </Notice>
 </div>
 ) : null}

 {inlineError ? (
 <div className="mt-3">
 <Notice kind="error" onClose={() => setInlineError(null)}>
 {inlineError}
 </Notice>
 </div>
 ) : null}

 {savedNotice ? (
 <div className="mt-3">
 <Notice kind="success" onClose={() => setSavedNotice(null)}>
 {savedNotice}
 </Notice>
 </div>
 ) : null}

 <WishlistCategoriesPanel
 listId={wishlist.id}
 categories={categories}
 filter={activeFilter}
 onFilterChange={setCategoryFilter}
 />

 <section className="mt-6">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h2 className="text-base font-semibold tracking-tight text-ink">Подарки</h2>
 <div className="flex flex-wrap items-center gap-2">
 <SortSelect
 value={effectiveSort}
 onChange={setSort}
 hideAvailability={hideAvailability}
 />
 <ViewModeSwitch value={view} onChange={setView} />
 </div>
 </div>

 <div className="mt-3">
 {gifts.length === 0 ? (
 <EmptyState
 title="Пока нет подарков"
 description="Нажмите «＋ Подарок» и заполните название, цену и ссылку — можно сразу всё."
 />
 ) : visibleGifts.length === 0 ? (
 <div className="rounded-xl border border-dashed border-ink bg-card p-6 text-center">
 <p className="text-base font-bold text-ink">По этому фильтру подарков нет</p>
 <p className="mt-1 text-sm font-medium text-muted">Попробуйте другую категорию.</p>
 <Button variant="secondary" className="mt-3" onClick={() => setCategoryFilter('all')}>
 Показать все
 </Button>
 </div>
 ) : (
 <GiftViews view={view} gifts={visibleGifts} adapter={adapter} />
 )}
 </div>

 {hasInlineAddRow ? null : (
 <AddGiftPanel listId={wishlist.id} categories={categories} />
 )}
 </section>

 {editingGift ? (
 <GiftEditModal
 key={editingGift.id}
 listId={wishlist.id}
 gift={editingGift}
 index={gifts.findIndex((item) => item.id === editingGift.id)}
 total={gifts.length}
 gifts={gifts}
 categories={categories}
 showReorder={effectiveSort === 'order'}
 onClose={() => setEditingId(null)}
 onSaved={() => {
 setEditingId(null);
 setSavedNotice('Сохранено');
 }}
 onDeleted={() => {
 setEditingId(null);
 setSavedNotice('Подарок удалён');
 }}
 />
 ) : null}
 </WishlistTheme>
 );
}

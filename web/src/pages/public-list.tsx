import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError, errorMessage } from '../lib/api';
import type { GiftDTO, PublicWishlistResponse } from '../lib/types';
import { formatDate, giftsCountLabel } from '../lib/format';
import { forgetBooking, getBookingsForToken, rememberBooking } from '../lib/my-bookings';
import type { MyBookingRecord } from '../lib/my-bookings';
import { filterGifts, resolveCategoryFilter } from '../lib/categories';
import type { CategoryFilter } from '../lib/categories';
import { sortGifts } from '../lib/sort';
import { useAuth } from '../hooks/use-auth';
import { useGiftSort } from '../hooks/use-gift-sort';
import { useFollowToggle } from '../hooks/use-social';
import { useViewMode } from '../hooks/use-view-mode';
import { BookGiftModal, UnbookGiftModal } from '../components/booking-modals';
import { Button, buttonClasses } from '../components/button';
import { CategoryFilter as CategoryFilterRow } from '../components/category-filter';
import type { GiftStatusView } from '../components/gift-badges';
import { GiftViews } from '../components/gift-views';
import type { GiftViewAdapter } from '../components/gift-views';
import { LinkifiedText } from '../components/linkified-text';
import { Notice } from '../components/notice';
import { SiteHeader } from '../components/site-header';
import { SortSelect } from '../components/sort-select';
import { UserAvatar } from '../components/user-avatar';
import { ViewModeSwitch } from '../components/view-mode-switch';
import { WishlistHero } from '../components/wishlist-hero';
import { WishlistTheme } from '../components/wishlist-theme';
import { ErrorBlock, LoadingBlock } from '../components/states';

interface PageNotice {
 kind: 'success' | 'error';
 text: string;
 hint?: string;
}

const BOOKED_MESSAGE = 'Готово! Подарок забронирован.';
const BOOKED_HINT =
 'Отметка «Забронировано вами» хранится только в этом браузере — по ней вы сможете отменить бронь.';
const UNBOOKED_MESSAGE = 'Бронирование отменено.';

function statusForGift(gift: GiftDTO, mine: MyBookingRecord | undefined): GiftStatusView {
 if (gift.status === 'gifted') {
 return { label: 'Подарен', tone: 'gifted' };
 }
 if (gift.booking !== null) {
 return mine
 ? { label: 'Забронировано вами', tone: 'mine' }
 : { label: 'Занят', tone: 'booked' };
 }
 return { label: 'Свободен', tone: 'free' };
}

export default function PublicListPage() {
 const { token = '' } = useParams<{ token: string }>();
 const location = useLocation();
 const { user: me } = useAuth();
 const [view, setView] = useViewMode();
 const [sort, setSort] = useGiftSort();
 const [giftToBook, setGiftToBook] = useState<GiftDTO | null>(null);
 const [giftToUnbook, setGiftToUnbook] = useState<GiftDTO | null>(null);
 const [notice, setNotice] = useState<PageNotice | null>(null);
 const [followError, setFollowError] = useState<string | null>(null);
 const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

 const query = useQuery<PublicWishlistResponse, ApiError>({
 queryKey: ['public-wishlist', token],
 queryFn: () => apiGet<PublicWishlistResponse>(`/w/${encodeURIComponent(token)}`),
 enabled: token !== '',
 });

 // Подписка на владельца: кнопка появляется только когда данные уже загружены.
 const ownerUsername = query.data?.wishlist.owner.username ?? '';
 const follow = useFollowToggle(ownerUsername);

 const myBookings = getBookingsForToken(token);

 // Устаревшая отметка (сервер уже отдал подарок свободным) больше не нужна.
 useEffect(() => {
 const data = query.data;
 if (!data) {
 return;
 }
 const records = getBookingsForToken(token);
 for (const gift of data.gifts) {
 if (gift.booking === null && records[gift.id]) {
 forgetBooking(token, gift.id);
 }
 }
 }, [query.data, token]);

 if (query.isPending) {
 return (
 <div className="min-h-dvh">
 <SiteHeader />
 <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-4 md:px-6 lg:px-8">
 <div className="h-8 w-2/3 animate-pulse rounded-lg bg-ink/15" />
 <div className="mt-6">
 <LoadingBlock rows={4} />
 </div>
 </main>
 </div>
 );
 }

 if (query.isError) {
 // 404 от API не даёт понять, существует ли список: не раскрываем детали.
 // Для гостя/не-подписчика так же выглядит список «только подписчикам»,
 // поэтому дополнительно подсказываем про подписку.
 const notFound = query.error.status === 404;
 const message = notFound ? 'Страница не найдена или недоступна.' : query.error.message;

 return (
 <div className="min-h-dvh">
 <SiteHeader />
 <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-4 md:px-6 lg:px-8">
 <ErrorBlock
 message={message}
 onRetry={() => {
 void query.refetch();
 }}
 />

 {notFound ? (
 <div className="nb-card mt-4 p-4">
 <p className="text-sm font-semibold tracking-wide text-ink">
 Список доступен только подписчикам
 </p>
 <p className="mt-1 text-sm font-medium text-muted">
 {me
 ? 'Подпишитесь на владельца в его публичном профиле, чтобы открыть этот список.'
 : 'Войдите и подпишитесь на владельца, чтобы открыть этот список.'}
 </p>
 {me ? null : (
 <Link
 to="/login"
 state={{ from: location.pathname }}
 className={[buttonClasses('primary', 'sm'), 'mt-3'].join(' ')}
 >
 Войти
 </Link>
 )}
 </div>
 ) : (
 <p className="mt-4 text-sm font-medium text-muted">
 Проверьте ссылку — возможно, её переслали не полностью.{' '}
 <Link
 to="/"
 className="font-bold text-ink underline decoration-2 underline-offset-2 hover:bg-accent-soft"
 >
 На главную
 </Link>
 </p>
 )}
 </main>
 </div>
 );
 }

 const { wishlist, gifts, viewer } = query.data;
 const categories = query.data.categories ?? [];
 const activeFilter = resolveCategoryFilter(categoryFilter, categories);
 const visibleGifts = sortGifts(filterGifts(gifts, activeFilter), sort);
 const meta = [formatDate(wishlist.eventDate), giftsCountLabel(gifts.length)]
 .filter(Boolean)
 .join(' · ');

 const adapter: GiftViewAdapter = {
 getStatus: (gift) => statusForGift(gift, myBookings[gift.id]),
 renderActions: (gift) => {
 if (gift.status === 'gifted') {
 return null;
 }
 if (gift.booking !== null) {
 return (
 <Button variant="secondary" size="sm" onClick={() => setGiftToUnbook(gift)}>
 Отменить бронирование
 </Button>
 );
 }
 return (
 <Button size="sm" onClick={() => setGiftToBook(gift)}>
 Забронировать
 </Button>
 );
 },
 };

 const isGuest = me === null;
 // «Профиль» виден всем, если профиль владельца открыт; владельцу — всегда.
 const canSeeProfile = wishlist.owner.isProfilePublic || viewer.isSelf;
 // Гость подписывается только через вход; подписаться нельзя, если профиль закрыт.
 const showLoginLink = isGuest && wishlist.owner.isProfilePublic;
 // Залогиненный не-владелец: подписка (canFollow) или отписка (isFollowing).
 const showFollowButton =
 !isGuest &&
 !viewer.isSelf &&
 wishlist.owner.isProfilePublic &&
 (viewer.canFollow || viewer.isFollowing);

 async function handleFollow() {
 setFollowError(null);
 try {
 await follow.mutateAsync(viewer.isFollowing ? 'unfollow' : 'follow');
 } catch (error) {
 setFollowError(errorMessage(error));
 }
 }

 return (
 <WishlistTheme
 themeColor={wishlist.themeColor ?? null}
 themeEmoji={wishlist.themeEmoji ?? null}
 seed={`${wishlist.id}:${wishlist.updatedAt ?? ''}`}
 className="min-h-dvh"
 >
 <SiteHeader />
 <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-4 md:px-6 lg:px-8">
 <WishlistHero
 coverPath={wishlist.coverPath ?? null}
 themeColor={wishlist.themeColor ?? null}
 className="mt-4"
 >
 <h1 className="break-words text-2xl font-semibold leading-tight text-ink sm:text-3xl">
 {wishlist.title}
 </h1>
 {wishlist.description ? (
 <LinkifiedText
 text={wishlist.description}
 className="mt-2 break-words text-sm font-medium text-muted"
 />
 ) : null}
 <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
 <UserAvatar
 name={wishlist.owner.displayName}
 username={wishlist.owner.username}
 size="sm"
 />
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold text-ink">
 {wishlist.owner.displayName}
 </p>
 <p className="truncate text-xs font-medium text-muted">
 @{wishlist.owner.username}
 </p>
 </div>
 <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
 {canSeeProfile ? (
 <Link
 to={`/u/${encodeURIComponent(wishlist.owner.username)}`}
 className={buttonClasses('secondary', 'sm')}
 >
 Профиль
 </Link>
 ) : null}
 {showLoginLink ? (
 <Link
 to="/login"
 state={{ from: location.pathname }}
 className={buttonClasses('primary', 'sm')}
 >
 Подписаться
 </Link>
 ) : null}
 {showFollowButton ? (
 <Button
 size="sm"
 variant={viewer.isFollowing ? 'secondary' : 'primary'}
 loading={follow.isPending}
 onClick={() => void handleFollow()}
 >
 {viewer.isFollowing ? 'Вы подписаны' : 'Подписаться'}
 </Button>
 ) : null}
 </div>
 </div>
 {meta ? (
 <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">
 {meta}
 </p>
 ) : null}
 </WishlistHero>

 {followError ? (
 <div className="mt-4">
 <Notice kind="error" onClose={() => setFollowError(null)}>
 {followError}
 </Notice>
 </div>
 ) : null}

 {notice ? (
 <div className="mt-4">
 <Notice kind={notice.kind} onClose={() => setNotice(null)}>
 <span className="block">{notice.text}</span>
 {notice.hint ? (
 <span className="mt-1 block text-xs font-medium opacity-90">{notice.hint}</span>
 ) : null}
 </Notice>
 </div>
 ) : null}

 <section className="mt-6">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h2 className="text-base font-semibold tracking-tight text-ink">Подарки</h2>
 <div className="flex flex-wrap items-center gap-2">
 <SortSelect value={sort} onChange={setSort} />
 <ViewModeSwitch value={view} onChange={setView} />
 </div>
 </div>

 {gifts.length === 0 ? (
 <div className="mt-3 rounded-xl border border-dashed border-ink bg-card p-6 text-center">
 <p className="text-base font-bold text-ink">Список пока пуст</p>
 <p className="mt-1 text-sm font-medium text-muted">
 Загляните позже — подарки скоро появятся.
 </p>
 </div>
 ) : (
 <>
 <CategoryFilterRow
 categories={categories}
 value={activeFilter}
 onChange={setCategoryFilter}
 />
 {visibleGifts.length === 0 ? (
 <div className="mt-3 rounded-xl border border-dashed border-ink bg-card p-6 text-center">
 <p className="text-base font-bold text-ink">По этому фильтру подарков нет</p>
 <p className="mt-1 text-sm font-medium text-muted">Попробуйте другую категорию.</p>
 <Button
 variant="secondary"
 className="mt-3"
 onClick={() => setCategoryFilter('all')}
 >
 Показать все
 </Button>
 </div>
 ) : (
 <div className="mt-3">
 <GiftViews view={view} gifts={visibleGifts} adapter={adapter} />
 </div>
 )}
 </>
 )}
 </section>

 <p className="mt-8 border-t border-line pt-6 text-center text-xs font-bold uppercase tracking-wide text-muted">
 Это вишлист — список желаний. Подарки можно бронировать без регистрации.
 </p>

 <BookGiftModal
 token={token}
 gift={giftToBook}
 onClose={() => setGiftToBook(null)}
 onBooked={(data) => {
 const gift = giftToBook;
 if (gift) {
 rememberBooking({
 shareToken: token,
 giftId: gift.id,
 name: data.name,
 email: data.email,
 createdAt: new Date().toISOString(),
 });
 }
 setGiftToBook(null);
 setNotice({ kind: 'success', text: BOOKED_MESSAGE, hint: BOOKED_HINT });
 }}
 />

 <UnbookGiftModal
 token={token}
 gift={giftToUnbook}
 initialEmail={giftToUnbook ? (myBookings[giftToUnbook.id]?.email ?? '') : ''}
 onClose={() => setGiftToUnbook(null)}
 onUnbooked={() => {
 if (giftToUnbook) {
 forgetBooking(token, giftToUnbook.id);
 }
 setGiftToUnbook(null);
 setNotice({ kind: 'success', text: UNBOOKED_MESSAGE });
 }}
 />
 </main>
 </WishlistTheme>
 );
}

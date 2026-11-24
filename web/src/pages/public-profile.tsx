import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import { useAuth } from '../hooks/use-auth';
import { useFollowToggle, usePublicProfile } from '../hooks/use-social';
import { Button, buttonClasses } from '../components/button';
import { Notice } from '../components/notice';
import { ProfileHeader } from '../components/profile-header';
import { SiteHeader } from '../components/site-header';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/states';
import { WishlistCard } from '../components/wishlist-card';

/** Панель в необруталистском стиле: 2px рамка + жёсткая тень. */
const panel = 'rounded-2xl border border-line bg-card';

/** Публичный профиль /u/:username: шапка, вишлисты, подписка. */
export default function PublicProfilePage() {
 const { username = '' } = useParams<{ username: string }>();
 const location = useLocation();
 const { user: me } = useAuth();
 const query = usePublicProfile(username);
 const follow = useFollowToggle(username);
 const [actionError, setActionError] = useState<string | null>(null);

 if (query.isPending) {
 return (
 <div className="min-h-dvh bg-paper">
 <SiteHeader />
 <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-6">
 <LoadingBlock rows={4} />
 </main>
 </div>
 );
 }

 if (query.isError) {
 if (query.error.status === 404) {
 return (
 <div className="min-h-dvh bg-paper">
 <SiteHeader />
 <main className="mx-auto w-full max-w-md px-4 pb-16 pt-10 text-center">
 <div className={`${panel} px-5 py-8`}>
 <p className="inline-flex h-16 w-16 items-center justify-center rounded-xl border border-line bg-accent-soft text-2xl font-semibold">
 404
 </p>
 <h1 className="mt-4 text-2xl font-semibold text-ink">Профиль недоступен</h1>
 <p className="mt-2 text-sm text-muted">
 Возможно, пользователь закрыл профиль или ссылка неверна.
 </p>
 <Link to="/" className={[buttonClasses('secondary'), 'mt-6'].join(' ')}>
 На главную
 </Link>
 </div>
 </main>
 </div>
 );
 }

 return (
 <div className="min-h-dvh bg-paper">
 <SiteHeader />
 <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:px-6">
 <ErrorBlock
 message={query.error.message}
 onRetry={() => {
 void query.refetch();
 }}
 />
 </main>
 </div>
 );
 }

 const { user, wishlists, viewer } = query.data;
 const isGuest = me === null;
 const followersCount = me?.followersCount ?? 0;
 const followingCount = me?.followingCount ?? 0;

 async function handleFollow() {
 setActionError(null);
 try {
 await follow.mutateAsync(viewer.isFollowing ? 'unfollow' : 'follow');
 } catch (error) {
 setActionError(errorMessage(error));
 }
 }

 return (
 <div className="min-h-dvh bg-paper">
 <SiteHeader />
 <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4 md:px-6 md:pt-6">
 <div className={`${panel} p-4 md:p-6`}>
 <ProfileHeader
 user={user}
 actions={
 viewer.isSelf ? (
 <>
 <Link to="/app/profile/edit" className={buttonClasses('primary', 'sm')}>
 Редактировать профиль
 </Link>
 <Link to="/app/followers" className={buttonClasses('secondary', 'sm')}>
 Подписчики: {followersCount}
 </Link>
 <Link to="/app/following" className={buttonClasses('secondary', 'sm')}>
 Подписки: {followingCount}
 </Link>
 </>
 ) : isGuest ? (
 <Link
 to="/login"
 state={{ from: location.pathname }}
 className={buttonClasses('primary', 'sm')}
 >
 Подписаться
 </Link>
 ) : viewer.canFollow ? (
 <Button
 size="sm"
 variant={viewer.isFollowing ? 'secondary' : 'primary'}
 loading={follow.isPending}
 onClick={() => void handleFollow()}
 >
 {viewer.isFollowing ? 'Вы подписаны' : 'Подписаться'}
 </Button>
 ) : null
 }
 />
 </div>

 {actionError ? (
 <div className="mt-3">
 <Notice kind="error" onClose={() => setActionError(null)}>
 {actionError}
 </Notice>
 </div>
 ) : null}

 <section className="mt-8">
 <div className="flex flex-wrap items-center gap-2">
 <h2 className="text-2xl font-semibold text-ink">Хотелки</h2>
 <span className="inline-flex items-center justify-center rounded-[6px] border border-line bg-butter-soft px-2 py-0.5 text-xs font-semibold">
 {wishlists.length}
 </span>
 </div>
 {wishlists.length === 0 ? (
 <div className="mt-3">
 <EmptyState
 title="Пока нет вишлистов"
 description={
 viewer.isSelf
 ? 'Создайте первый список — гости смогут бронировать подарки.'
 : 'Пользователь ещё не опубликовал списки желаний.'
 }
 />
 </div>
 ) : (
 <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
 {wishlists.map((wishlist) => (
 <WishlistCard
 key={wishlist.id}
 wishlist={wishlist}
 href={viewer.isSelf ? `/app/lists/${wishlist.id}` : `/w/${wishlist.shareToken}`}
 />
 ))}
 </div>
 )}
 </section>
 </main>
 </div>
 );
}

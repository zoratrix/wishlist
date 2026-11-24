import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError } from '../lib/api';
import type { WishlistsResponse } from '../lib/types';
import { useAuth } from '../hooks/use-auth';
import { Button, buttonClasses } from '../components/button';
import { CreateWishlistModal } from '../components/create-wishlist-modal';
import { ProfileHeader } from '../components/profile-header';
import { WishlistCard } from '../components/wishlist-card';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/states';

/** Панель в необруталистском стиле: 2px рамка + жёсткая тень. */
const panel = 'rounded-2xl border border-line bg-card';

/** /app/profile — профиль в аккаунте, выглядит как публичный. */
export default function AccountProfilePage() {
 const { user } = useAuth();
 const navigate = useNavigate();
 const [isCreating, setIsCreating] = useState(false);

 const query = useQuery<WishlistsResponse, ApiError>({
 queryKey: ['wishlists'],
 queryFn: () => apiGet<WishlistsResponse>('/me/wishlists'),
 });

 if (!user) {
 return null;
 }

 const wishlists = query.data?.wishlists ?? [];

 return (
 <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 md:px-6 md:pt-6">
 <div className={`${panel} p-4 md:p-6`}>
 <ProfileHeader
 user={user}
 actions={
 <>
 <Link to="/app/followers" className={buttonClasses('secondary', 'sm')}>
 Подписчики: {user.followersCount ?? 0}
 </Link>
 <Link to="/app/following" className={buttonClasses('secondary', 'sm')}>
 Подписки: {user.followingCount ?? 0}
 </Link>
 <Link to="/app/profile/edit" className={buttonClasses('primary', 'sm')}>
 Редактировать профиль
 </Link>
 </>
 }
 />
 </div>

 <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
 <h2 className="text-2xl font-semibold text-ink">Мои вишлисты</h2>
 <Button size="sm" onClick={() => setIsCreating(true)}>
 ＋ Новый список
 </Button>
 </div>

 {query.isPending ? (
 <div className="mt-4">
 <LoadingBlock rows={2} />
 </div>
 ) : query.isError ? (
 <div className="mt-4">
 <ErrorBlock
 message={query.error.message}
 onRetry={() => {
 void query.refetch();
 }}
 />
 </div>
 ) : wishlists.length === 0 ? (
 <div className="mt-4">
 <EmptyState
 title="Пока нет списков"
 description="Создайте первый — например, «День рождения»."
 action={<Button onClick={() => setIsCreating(true)}>Создать первый список</Button>}
 />
 </div>
 ) : (
 <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
 {wishlists.map((wishlist) => (
 <WishlistCard
 key={wishlist.id}
 wishlist={wishlist}
 href={`/app/lists/${wishlist.id}`}
 action={
 <Link
 to={`/app/lists/${wishlist.id}`}
 className={buttonClasses('secondary', 'sm')}
 >
 Редактировать
 </Link>
 }
 />
 ))}
 </div>
 )}

 <CreateWishlistModal
 open={isCreating}
 onClose={() => setIsCreating(false)}
 onCreated={(wishlist) => {
 setIsCreating(false);
 navigate(`/app/lists/${wishlist.id}`);
 }}
 />
 </div>
 );
}

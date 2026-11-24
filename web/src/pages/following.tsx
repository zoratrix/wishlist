import { useFollowing, useUnfollowUser } from '../hooks/use-social';
import { FollowListPage } from '../components/follow-list-page';

/** «Мои подписки»: за кем следит владелец. */
export default function FollowingPage() {
 const query = useFollowing();
 const unfollow = useUnfollowUser();

 return (
 <FollowListPage
 title="Мои подписки"
 description="Профили, за которыми вы следите. Отсюда можно отписаться."
 emptyTitle="Пока нет подписок"
 emptyDescription="Откройте публичный профиль и нажмите «Подписаться»."
 actionLabel="Отписаться"
 confirmTitle="Отписаться?"
 confirmMessage={(user) => `Перестать следить за «${user.displayName}»?`}
 users={query.data?.users ?? []}
 total={query.data?.total ?? 0}
 isLoading={query.isPending}
 errorText={query.isError ? query.error.message : null}
 onRetry={() => {
 void query.refetch();
 }}
 isActionPending={unfollow.isPending}
 onAction={async (user) => {
 await unfollow.mutateAsync(user.username);
 }}
 />
 );
}

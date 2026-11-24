import { useFollowers, useRemoveFollower } from '../hooks/use-social';
import { FollowListPage } from '../components/follow-list-page';

/** «Мои подписчики»: кто следит за вишлистами владельца. */
export default function FollowersPage() {
 const query = useFollowers();
 const remove = useRemoveFollower();

 return (
 <FollowListPage
 title="Мои подписчики"
 description="Люди, которые следят за вашими вишлистами и видят списки «только подписчикам»."
 emptyTitle="Пока нет подписчиков"
 emptyDescription="Когда кто-то подпишется на ваш профиль, он появится здесь."
 actionLabel="Удалить подписчика"
 confirmTitle="Удалить подписчика?"
 confirmMessage={(user) =>
 `«${user.displayName}» больше не будет видеть списки, доступные подписчикам.`
 }
 users={query.data?.users ?? []}
 total={query.data?.total ?? 0}
 isLoading={query.isPending}
 errorText={query.isError ? query.error.message : null}
 onRetry={() => {
 void query.refetch();
 }}
 isActionPending={remove.isPending}
 onAction={async (user) => {
 await remove.mutateAsync(user.id);
 }}
 />
 );
}

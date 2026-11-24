import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet, ApiError } from '../lib/api';
import type { FeedItem, FeedResponse } from '../lib/types';
import { formatBirthday, formatDate, pluralRu } from '../lib/format';
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/states';
import { UserAvatar } from '../components/user-avatar';

/** Карточка ленты: 2px рамка + жёсткая тень, как на остальных страницах. */
const feedCard =
 'rounded-2xl border border-line bg-card transition-transform hover:-translate-y-0.5';

function birthdayCaption(item: Extract<FeedItem, { type: 'birthday' }>): string {
 const [monthPart, dayPart] = item.date.split('-');
 const month = Number(monthPart);
 const day = Number(dayPart);
 const date = formatBirthday(Number.isNaN(month) ? null : month, Number.isNaN(day) ? null : day);
 const dayWord = pluralRu(item.inDays, 'день', 'дня', 'дней');

 if (item.inDays === 0) {
 return `${date || item.date} — сегодня`;
 }
 if (item.inDays === 1) {
 return `${date || item.date} — завтра`;
 }
 return `${date || item.date} — через ${item.inDays} ${dayWord}`;
}

/** /app/feed — списки подписок и их ближайшие дни рождения. */
export default function FeedPage() {
 const query = useQuery<FeedResponse, ApiError>({
 queryKey: ['feed'],
 queryFn: () => apiGet<FeedResponse>('/me/feed'),
 });

 const items = query.data?.items ?? [];

 return (
 <div className="mx-auto w-full max-w-5xl px-4 pt-4 md:px-6 md:pt-6">
 <h1 className="text-3xl font-semibold text-ink">Лента</h1>
 <p className="mt-1 text-sm text-muted">Новые вишлисты подписок и их дни рождения.</p>

 <div className="mt-5">
 {query.isPending ? (
 <LoadingBlock rows={3} />
 ) : query.isError ? (
 <ErrorBlock
 message={query.error.message}
 onRetry={() => {
 void query.refetch();
 }}
 />
 ) : items.length === 0 ? (
 <EmptyState
 title="Пока пусто"
 description="Подпишитесь на кого-нибудь — здесь появятся их вишлисты и дни рождения."
 />
 ) : (
 <ul className="space-y-3">
 {items.map((item, index) =>
 item.type === 'wishlist' ? (
 <li key={`wishlist-${item.wishlist.id}-${index}`}>
 <Link
 to={`/w/${item.wishlist.shareToken}`}
 data-feed-type="wishlist"
 className={`flex items-start gap-3 p-3.5 sm:p-4 ${feedCard} hover:border-accent`}
 >
 <UserAvatar
 name={item.wishlist.owner.displayName}
 username={item.wishlist.owner.username}
 avatarPath={item.wishlist.owner.avatarPath}
 size="md"
 />
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
 Новый список
 </p>
 <p className="mt-0.5 text-xs text-muted">
 {item.wishlist.owner.displayName} · @{item.wishlist.owner.username}
 </p>
 <p className="mt-1 truncate text-base font-semibold text-ink">
 {item.wishlist.title}
 </p>
 <p className="mt-1 text-xs text-muted">{formatDate(item.at.slice(0, 10))}</p>
 </div>
 <span
 aria-hidden="true"
 className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-line bg-butter-soft text-lg"
 >
 🎁
 </span>
 </Link>
 </li>
 ) : (
 <li
 key={`birthday-${item.user.username}-${index}`}
 data-feed-type="birthday"
 className={`flex items-start gap-3 p-3.5 sm:p-4 ${feedCard}`}
 >
 <UserAvatar
 name={item.user.displayName}
 username={item.user.username}
 avatarPath={item.user.avatarPath}
 size="md"
 />
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
 Праздник
 </p>
 <Link
 to={`/u/${item.user.username}`}
 className="mt-0.5 block truncate font-semibold text-ink underline-offset-2 hover:underline"
 >
 {item.user.displayName}
 </Link>
 <p className="mt-0.5 text-sm text-muted">{birthdayCaption(item)}</p>
 </div>
 <span
 aria-hidden="true"
 className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-line bg-powder-soft text-lg"
 >
 🎂
 </span>
 </li>
 ),
 )}
 </ul>
 )}
 </div>
 </div>
 );
}

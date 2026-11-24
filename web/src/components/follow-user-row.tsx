import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { FollowUserDTO } from '../lib/types';
import { UserAvatar } from './user-avatar';

/** Строка человека в списках «подписчики/подписки». */
export function FollowUserRow({ user, action }: { user: FollowUserDTO; action: ReactNode }) {
 return (
 <li className="nb-card p-3">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
 <div className="flex min-w-0 flex-1 items-start gap-3">
 <UserAvatar name={user.displayName} username={user.username} size="md" />
 <div className="min-w-0 flex-1">
 <Link
 to={`/u/${user.username}`}
 className="nb-focus inline-flex min-h-11 items-center text-base font-semibold leading-tight text-ink underline decoration-2 underline-offset-4 hover:decoration-accent"
 >
 {user.displayName}
 </Link>
 <p className="text-xs font-semibold text-muted">@{user.username}</p>
 {user.bio ? (
 <p className="mt-1 line-clamp-2 text-sm font-medium text-ink">{user.bio}</p>
 ) : null}
 </div>
 </div>
 <div className="shrink-0">{action}</div>
 </div>
 </li>
 );
}

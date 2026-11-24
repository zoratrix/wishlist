import type { ReactNode } from 'react';
import type { UserPublicDTO } from '../lib/types';
import { formatBirthday } from '../lib/format';
import { UserAvatar } from './user-avatar';

export interface ProfileHeaderProps {
 user: UserPublicDTO;
 /** Кнопки/ссылки под bio: подписка, счётчики, редактирование. */
 actions?: ReactNode;
}

/**
 * Шапка профиля — одинаковая для /u/:username и /app/profile.
 * Необрутализм: крупное жирное имя, ник и дата — «наклейки» с чёрной рамкой
 * и жёсткой тенью.
 */
export function ProfileHeader({ user, actions }: ProfileHeaderProps) {
 const birthday = formatBirthday(user.birthMonth, user.birthDay, user.birthYear, user.showBirthYear);

 return (
 <header className="flex flex-wrap items-start gap-3 sm:gap-4">
 <UserAvatar
 name={user.displayName}
 username={user.username}
 avatarPath={user.avatarPath}
 size="lg"
 />
 <div className="min-w-0 flex-1">
 <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-tight text-ink sm:text-4xl">
 {user.displayName}
 </h1>
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <span className="nb-badge bg-paper px-2 py-1 text-xs text-ink">@{user.username}</span>
 {birthday ? (
 <span className="nb-badge bg-butter-soft px-2 py-1 text-xs text-ink">
 <span aria-hidden="true">🎂</span>
 День рождения: {birthday}
 </span>
 ) : null}
 </div>
 {user.bio ? (
 <p className="mt-3 whitespace-pre-line text-sm font-medium leading-relaxed text-ink">
 {user.bio}
 </p>
 ) : null}
 {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
 </div>
 </header>
 );
}

export interface UserAvatarProps {
 name: string;
 username?: string;
 avatarPath?: string | null;
 size?: 'sm' | 'md' | 'lg';
 className?: string;
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
 sm: 'h-9 w-9 text-sm',
 md: 'h-12 w-12 text-base',
 lg: 'h-20 w-20 text-2xl',
};

/* Стикерные подложки под букву: детерминированно от имени, из палитры. */
const TINTS = ['bg-accent-soft', 'bg-lavender', 'bg-mint-soft', 'bg-butter-soft', 'bg-powder-soft'];

/** Аватар: круглая картинка/буква с тонким контуром. */
export function UserAvatar({ name, username, avatarPath, size = 'md', className }: UserAvatarProps) {
 const source = name.trim() || username || '?';
 const letter = source.charAt(0).toUpperCase();
 const sizeClass = SIZE_CLASS[size];
 const tint = TINTS[source.charCodeAt(0) % TINTS.length] ?? 'bg-accent-soft';

 if (avatarPath) {
 return (
 <img
 src={avatarPath}
 alt=""
 className={[
 'shrink-0 rounded-full border border-line bg-card object-cover',
 sizeClass,
 className ?? '',
 ]
 .join(' ')
 .trim()}
 />
 );
 }

 return (
 <span
 aria-hidden="true"
 className={[
 'flex shrink-0 items-center justify-center rounded-full border border-ink/15 font-semibold text-ink',
 tint,
 sizeClass,
 className ?? '',
 ]
 .join(' ')
 .trim()}
 >
 {letter}
 </span>
 );
}

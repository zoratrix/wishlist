import type { ReactNode } from 'react';

export type NoticeKind = 'success' | 'error' | 'info';

/* Цветная «наклейка»: светлая палитра + ink-текст — контраст не падает. */
const STYLES: Record<NoticeKind, string> = {
 success: 'bg-mint-soft text-ink',
 error: 'bg-powder-soft text-ink',
 info: 'bg-butter-soft text-ink',
};

const ICONS: Record<NoticeKind, string> = {
 success: '✓',
 error: '!',
 info: 'i',
};

export interface NoticeProps {
 kind?: NoticeKind;
 children: ReactNode;
 onClose?: () => void;
}

/** Короткое сообщение об успехе/ошибке; озвучивается скринридером. */
export function Notice({ kind = 'info', children, onClose }: NoticeProps) {
 return (
 <div
 role={kind === 'error' ? 'alert' : 'status'}
 className={[
 'flex items-start gap-2.5 rounded-2xl border border-ink px-3.5 py-2.5',
 'text-sm font-medium',
 STYLES[kind],
 ].join(' ')}
 >
 <span
 aria-hidden="true"
 className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink bg-card text-xs font-semibold leading-none"
 >
 {ICONS[kind]}
 </span>
 <p className="min-w-0 flex-1">{children}</p>
 {onClose ? (
 <button
 type="button"
 onClick={onClose}
 aria-label="Закрыть сообщение"
 className="nb-focus -my-1.5 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-base font-bold leading-none hover:bg-ink/10"
 >
 ✕
 </button>
 ) : null}
 </div>
 );
}

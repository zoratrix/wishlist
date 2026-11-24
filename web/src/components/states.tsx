import type { ReactNode } from 'react';
import { Button } from './button';

/** Скелетоны строк: экран не должен «прыгать» пустотой. */
export function LoadingBlock({ rows = 3, label = 'Загрузка…' }: { rows?: number; label?: string }) {
 return (
 <div aria-busy="true" aria-live="polite" className="space-y-2">
 <p className="sr-only">{label}</p>
 {Array.from({ length: rows }, (_value, index) => (
 <div
 key={index}
 className="flex items-center gap-3 rounded-lg border border-ink bg-card px-3 py-4"
 >
 <div className="h-9 w-9 shrink-0 animate-pulse rounded-md border border-line bg-paper" />
 <div className="flex-1 space-y-2">
 <div className="h-3 w-2/3 animate-pulse rounded-full bg-ink/15" />
 <div className="h-3 w-1/3 animate-pulse rounded-full bg-ink/10" />
 </div>
 </div>
 ))}
 </div>
 );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
 return (
 <div className="nb-card p-4">
 <div className="flex items-center gap-2">
 <span
 aria-hidden="true"
 className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-danger-soft text-sm font-semibold leading-none"
 >
 !
 </span>
 <p className="text-sm font-bold tracking-wide text-danger">
 Не удалось загрузить
 </p>
 </div>
 <p className="mt-2 text-sm font-medium text-muted">{message}</p>
 {onRetry ? (
 <Button variant="secondary" className="mt-3" onClick={onRetry}>
 Повторить
 </Button>
 ) : null}
 </div>
 );
}

export function EmptyState({
 title,
 description,
 action,
}: {
 title: string;
 description?: string;
 action?: ReactNode;
}) {
 return (
 <div className="rounded-xl border border-dashed border-ink bg-card p-6 text-center">
 <p className="text-base font-bold text-ink">{title}</p>
 {description ? <p className="mt-1 text-sm font-medium text-muted">{description}</p> : null}
 {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
 </div>
 );
}

/** Во весь экран: используется, пока неизвестно, вошёл ли пользователь. */
export function FullPage({ children }: { children: ReactNode }) {
 return (
 <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
 {children}
 </main>
 );
}

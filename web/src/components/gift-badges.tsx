import { formatPrice, priorityMeta } from '../lib/format';

export type GiftStatusTone = 'free' | 'booked' | 'mine' | 'gifted';

export interface GiftStatusView {
 label: string;
 tone: GiftStatusTone;
}

/*
 * Стикеры: мягкая цветная подложка + ink-текст и чёрная рамка (из nb-badge).
 * Белый текст не используем — контраст тёмного на светлом стабилен.
 */
const TONE_CLASS: Record<GiftStatusTone, string> = {
 free: 'bg-ok-soft text-ink',
 booked: 'bg-powder-soft text-ink',
 mine: 'bg-lavender-soft text-ink',
 gifted: 'bg-butter-soft text-ink',
};

/** Бейдж статуса подарка — одинаковый во всех видах. */
export function StatusBadge({ status }: { status: GiftStatusView }) {
 return (
 <span
 className={[
 'nb-badge min-w-0 max-w-full px-2 py-1 text-left text-[11px] font-bold leading-tight',
 TONE_CLASS[status.tone],
 ].join(' ')}
 >
 {status.label}
 </span>
 );
}

/** Цветная точка приоритета + подпись. */
export function PriorityMark({ priority }: { priority: number }) {
 const meta = priorityMeta(priority);
 return (
 <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-bold leading-tight text-ink">
 <span
 aria-hidden="true"
 className={['h-2 w-2 shrink-0 rounded-full', meta.dot].join(' ')}
 />
 <span className="min-w-0 break-words">{meta.label}</span>
 </span>
 );
}

/** Бейдж приоритета для карточек. */
export function PriorityBadge({ priority }: { priority: number }) {
 const meta = priorityMeta(priority);
 return (
 <span className="nb-badge bg-paper px-2 py-1 text-[11px] font-bold leading-tight text-ink">
 <span
 aria-hidden="true"
 className={['h-2 w-2 shrink-0 rounded-full', meta.dot].join(' ')}
 />
 <span className="min-w-0 break-words">{meta.label}</span>
 </span>
 );
}

export function GiftPrice({
 priceMinor,
 className,
}: {
 priceMinor: number | null;
 className?: string;
}) {
 if (priceMinor === null) {
 return null;
 }
 return (
 <span className={['tabular-nums whitespace-nowrap', className ?? ''].join(' ').trim()}>
 {formatPrice(priceMinor)}
 </span>
 );
}

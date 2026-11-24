import { VIEW_MODE_OPTIONS } from '../lib/view-mode';
import type { GiftViewMode } from '../lib/view-mode';

export interface ViewModeSwitchProps {
 value: GiftViewMode;
 onChange: (mode: GiftViewMode) => void;
 className?: string;
}

/**
 * Сегментированный переключатель «Таблица / Карточки»: чёрная рамка 2px,
 * жёсткая тень и цветная наклейка на активном варианте.
 */
export function ViewModeSwitch({ value, onChange, className }: ViewModeSwitchProps) {
 return (
 <div
 role="group"
 aria-label="Вид подарков"
 className={[
 'inline-flex max-w-full rounded-full border border-ink bg-card p-1',
 className ?? '',
 ]
 .join(' ')
 .trim()}
 >
 {VIEW_MODE_OPTIONS.map((option) => {
 const active = option.value === value;
 return (
 <button
 key={option.value}
 type="button"
 aria-pressed={active}
 onClick={() => onChange(option.value)}
 className={[
 'nb-focus min-h-11 min-w-0 rounded-full border px-3 text-sm font-medium transition-colors',
 'active:translate-x-[2px] active:translate-y-[2px]',
 active
 ? 'border-ink bg-accent text-ink'
 : 'border-transparent text-ink hover:border-ink hover:bg-paper',
 ].join(' ')}
 >
 {option.label}
 </button>
 );
 })}
 </div>
 );
}

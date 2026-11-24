import { SORT_OPTIONS } from '../lib/sort';
import type { GiftSort } from '../lib/sort';

export interface SortSelectProps {
 value: GiftSort;
 onChange: (sort: GiftSort) => void;
 /** Скрыть «Сначала свободные/занятые» (владелец при showBooked=false). */
 hideAvailability?: boolean;
}

/** Выбор сортировки списка подарков — рядом с переключателем вида. */
export function SortSelect({ value, onChange, hideAvailability = false }: SortSelectProps) {
 const options = SORT_OPTIONS.filter(
 (option) => !(hideAvailability && option.availability === true),
 );

 return (
 <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink">
 <span className="shrink-0">Сортировка</span>
 <select
 aria-label="Сортировка подарков"
 value={value}
 onChange={(event) => onChange(event.target.value as GiftSort)}
 className={[
 'min-h-11 min-w-0 max-w-full rounded-full border border-ink bg-card px-2 text-sm font-medium text-ink',
 ' transition-shadow focus:outline-none',
 ].join(' ')}
 >
 {options.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 </label>
 );
}

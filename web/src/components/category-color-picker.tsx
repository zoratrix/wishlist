import { CATEGORY_COLORS } from '../lib/category-colors';

export interface CategoryColorPickerProps {
 value: string | null;
 onChange: (color: string | null) => void;
 disabled?: boolean;
 /** Уточнение для aria-label, если пикеров на странице несколько. */
 namePrefix?: string;
}

/**
 * Ряд цветовых свотчей: 8 цветов палитры + «по умолчанию» (null).
 * Кнопки доступны с клавиатуры, выбранный цвет помечен aria-pressed.
 * Необрутализм: 2px чёрная рамка, жёсткая тень, тач-цель 44×44.
 */
export function CategoryColorPicker({
 value,
 onChange,
 disabled = false,
 namePrefix,
}: CategoryColorPickerProps) {
 const suffix = namePrefix ? ` ${namePrefix}` : '';

 const swatchClass = [
 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line',
 'nb-focus disabled:cursor-not-allowed disabled:opacity-50',
 ].join(' ');

 return (
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-xs font-bold uppercase tracking-wide text-muted">Цвет:</span>
 <button
 type="button"
 disabled={disabled}
 aria-pressed={value === null}
 aria-label={`Цвет по умолчанию${suffix}`}
 title="По умолчанию"
 onClick={() => onChange(null)}
 className={[
 swatchClass,
 value === null
 ? 'bg-accent text-ink outline-2 outline-offset-2 outline-ink'
 : 'bg-paper text-muted',
 ].join(' ')}
 >
 <span aria-hidden="true" className="text-base font-semibold">
 ×
 </span>
 </button>

 {CATEGORY_COLORS.map((color) => (
 <button
 key={color}
 type="button"
 disabled={disabled}
 aria-pressed={value === color}
 aria-label={`Цвет ${color}${suffix}`}
 title={color}
 onClick={() => onChange(color)}
 className={[
 swatchClass,
 value === color ? 'outline-2 outline-offset-2 outline-ink' : '',
 ].join(' ')}
 style={{ backgroundColor: color }}
 />
 ))}
 </div>
 );
}

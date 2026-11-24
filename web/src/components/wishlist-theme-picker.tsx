import { useEffect, useState } from 'react';
import { normalizeThemeColor, WISHLIST_THEME_COLORS } from '../lib/wishlist-theme';

export interface WishlistThemePickerProps {
 value: string | null;
 onChange: (color: string | null) => void;
 disabled?: boolean;
}

const CUSTOM_ERROR = 'Введите цвет в формате #RRGGBB.';

const swatchClass = [
 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line',
 'nb-focus disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const customInputClass = [
 'mt-1 min-h-11 w-full rounded-lg border border-ink bg-card px-2 text-base font-semibold text-ink',
 'uppercase placeholder:normal-case placeholder:font-normal',
 'placeholder:text-muted focus:outline-none',
 'disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

const applyButtonClass = [
 'nb-focus inline-flex min-h-11 items-center justify-center',
 'rounded-lg border border-ink bg-card px-3 text-sm font-bold text-ink',
 'hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60',
].join(' ');

/**
 * Свотчи темы вишлиста: 8 приглушённых цветов, «по умолчанию» и свой цвет
 * в формате #RRGGBB (тема может быть любым цветом).
 * Необрутализм: 2px рамка, жёсткая тень, тач-цель 44×44.
 */
export function WishlistThemePicker({ value, onChange, disabled = false }: WishlistThemePickerProps) {
 const isPreset =
 value !== null && (WISHLIST_THEME_COLORS as readonly string[]).includes(value);
 const [customValue, setCustomValue] = useState(() => (value !== null && !isPreset ? value : ''));
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 if (value === null) {
 setCustomValue('');
 return;
 }
 if (!(WISHLIST_THEME_COLORS as readonly string[]).includes(value)) {
 setCustomValue(value);
 }
 }, [value]);

 function applyCustom() {
 const normalized = normalizeThemeColor(customValue.trim());
 if (normalized === null) {
 setError(CUSTOM_ERROR);
 return;
 }
 setError(null);
 setCustomValue(normalized);
 onChange(normalized);
 }

 const customId = 'wishlist-theme-custom-color';

 return (
 <div data-wl-theme-picker="true">
 <div
 role="group"
 aria-label="Цвет темы списка"
 className="flex flex-wrap items-center gap-2"
 >
 <button
 type="button"
 disabled={disabled}
 aria-pressed={value === null}
 aria-label="Тема по умолчанию"
 onClick={() => onChange(null)}
 className={[
 swatchClass,
 value === null
 ? 'bg-accent text-ink outline-2 outline-offset-2 outline-ink'
 : 'bg-paper text-muted',
 ].join(' ')}
 >
 <span aria-hidden="true" className="text-base font-semibold leading-none">
 ×
 </span>
 </button>

 {WISHLIST_THEME_COLORS.map((color) => (
 <button
 key={color}
 type="button"
 disabled={disabled}
 aria-pressed={value === color}
 aria-label={`Цвет темы ${color}`}
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

 <div className="mt-3 flex flex-wrap items-end gap-2">
 <div className="min-w-0 flex-1 sm:max-w-48">
 <label htmlFor={customId} className="block text-xs font-bold uppercase tracking-wide text-ink">
 Свой цвет
 </label>
 <input
 id={customId}
 type="text"
 value={customValue}
 maxLength={7}
 disabled={disabled}
 autoComplete="off"
 spellCheck={false}
 placeholder="#RRGGBB"
 aria-invalid={error !== null}
 aria-describedby={error ? `${customId}-error` : undefined}
 onChange={(event) => {
 setCustomValue(event.target.value);
 setError(null);
 }}
 onKeyDown={(event) => {
 if (event.key === 'Enter') {
 event.preventDefault();
 applyCustom();
 }
 }}
 className={customInputClass}
 />
 </div>
 {isPreset || value === null ? null : (
 <span
 aria-hidden="true"
 className="h-11 w-11 shrink-0 rounded-lg border border-line"
 style={{ backgroundColor: value }}
 />
 )}
 <button type="button" disabled={disabled} onClick={applyCustom} className={applyButtonClass}>
 Применить
 </button>
 </div>
 {error ? (
 <p id={`${customId}-error`} role="alert" className="mt-1 text-xs font-bold text-danger">
 {error}
 </p>
 ) : (
 <p className="mt-1 text-xs font-medium text-muted">Любой цвет в формате #RRGGBB.</p>
 )}
 </div>
 );
}

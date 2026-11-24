import { useState } from 'react';
import {
 isThemeEmoji,
 isWishlistEmojiPreset,
 normalizeThemeEmoji,
 WISHLIST_EMOJI_PRESETS,
} from '../lib/wishlist-theme';

export interface WishlistEmojiPickerProps {
 value: string | null;
 onChange: (emoji: string | null) => void;
 disabled?: boolean;
}

const CUSTOM_ERROR = 'Нужен один эмодзи до 8 символов — без букв и цифр.';

const optionClass = [
 'nb-focus inline-flex h-11 min-w-11 shrink-0 items-center justify-center',
 'rounded-lg border border-line bg-card text-xl text-ink',
 'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const selectedClass = 'outline-2 outline-offset-2 outline-ink';

/**
 * Выбор эмодзи-фона: набор предлагаемых, поле своего и «без эмодзи».
 * Сохраняется общим PATCH настроек списка, здесь только выбор.
 * Необрутализм: 2px рамка, жёсткая тень, тач-цель 44×44.
 */
export function WishlistEmojiPicker({
 value,
 onChange,
 disabled = false,
}: WishlistEmojiPickerProps) {
 const [customValue, setCustomValue] = useState(() =>
 value !== null && !isWishlistEmojiPreset(value) ? value : '',
 );
 const [customError, setCustomError] = useState<string | null>(null);

 function selectPreset(emoji: string) {
 setCustomValue('');
 setCustomError(null);
 onChange(emoji);
 }

 function selectNone() {
 setCustomValue('');
 setCustomError(null);
 onChange(null);
 }

 function handleCustomChange(raw: string) {
 setCustomValue(raw);
 const normalized = normalizeThemeEmoji(raw);
 if (normalized === null) {
 setCustomError(null);
 onChange(null);
 return;
 }
 if (isThemeEmoji(normalized)) {
 setCustomError(null);
 onChange(normalized);
 return;
 }
 setCustomError(CUSTOM_ERROR);
 onChange(null);
 }

 const inputId = 'wishlist-theme-emoji-custom';

 return (
 <div data-wl-emoji-picker="true">
 <div
 role="group"
 aria-label="Эмодзи-фон списка"
 className="flex flex-wrap items-center gap-2"
 >
 <button
 type="button"
 disabled={disabled}
 aria-pressed={value === null}
 aria-label="Без эмодзи"
 onClick={selectNone}
 className={[
 optionClass,
 'px-3 text-sm font-bold',
 value === null ? `bg-accent ${selectedClass}` : '',
 ].join(' ')}
 >
 Без эмодзи
 </button>

 {WISHLIST_EMOJI_PRESETS.map((emoji) => (
 <button
 key={emoji}
 type="button"
 disabled={disabled}
 aria-pressed={value === emoji}
 aria-label={`Эмодзи ${emoji}`}
 title={emoji}
 onClick={() => selectPreset(emoji)}
 className={[optionClass, value === emoji ? selectedClass : ''].join(' ')}
 >
 <span aria-hidden="true">{emoji}</span>
 </button>
 ))}
 </div>

 <div className="mt-3">
 <label htmlFor={inputId} className="block text-sm font-bold text-ink">
 Свой эмодзи
 </label>
 <input
 id={inputId}
 type="text"
 value={customValue}
 maxLength={8}
 disabled={disabled}
 inputMode="text"
 autoComplete="off"
 placeholder="Например, 🦄"
 aria-describedby={`${inputId}-hint`}
 aria-invalid={customError !== null}
 onChange={(event) => handleCustomChange(event.target.value)}
 className={[
 'mt-1 min-h-11 w-full rounded-lg border border-ink bg-card px-3 text-base text-ink',
 ' placeholder:text-muted ',
 'focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
 ].join(' ')}
 />
 <p id={`${inputId}-hint`} className="mt-1 text-xs font-medium text-muted">
 Один эмодзи, до 8 символов. Если эмодзи не нужен — «Без эмодзи».
 </p>
 {customError ? (
 <p role="alert" className="mt-1 text-xs font-bold text-danger">
 {customError}
 </p>
 ) : null}
 </div>
 </div>
 );
}

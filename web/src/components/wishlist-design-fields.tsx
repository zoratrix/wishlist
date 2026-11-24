import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiUpload, errorMessage } from '../lib/api';
import type { WishlistResponse } from '../lib/types';
import { darkenThemeColor, themeTint } from '../lib/wishlist-theme';
import { suggestThemeFromImage, type CoverThemeSuggestion } from '../lib/cover-colors';
import { Button } from './button';
import { WishlistEmojiPicker } from './wishlist-emoji-picker';
import { WishlistThemePicker } from './wishlist-theme-picker';

export interface DesignNotice {
 kind: 'success' | 'error';
 text: string;
}

export interface WishlistDesignFieldsProps {
 listId: string;
 themeColor: string | null;
 onThemeChange: (color: string | null) => void;
 themeEmoji: string | null;
 onEmojiChange: (emoji: string | null) => void;
 initialCoverPath: string | null;
 onNotice: (notice: DesignNotice) => void;
}

const FIELD_LABEL = 'text-sm font-semibold tracking-wide text-ink';
const HINT = 'mt-1 text-xs font-medium text-muted';

/** Блок «Оформление» в настройках списка: тема, эмодзи-фон и обложка. */
export function WishlistDesignFields({
 listId,
 themeColor,
 onThemeChange,
 themeEmoji,
 onEmojiChange,
 initialCoverPath,
 onNotice,
}: WishlistDesignFieldsProps) {
 const queryClient = useQueryClient();
 const [coverPath, setCoverPath] = useState<string | null>(initialCoverPath ?? null);
 const [coverPreview, setCoverPreview] = useState<string | null>(null);
 const [coverPending, setCoverPending] = useState(false);
 const [coverInputKey, setCoverInputKey] = useState(0);
 const [suggestion, setSuggestion] = useState<CoverThemeSuggestion | null>(null);
 const [suggesting, setSuggesting] = useState(false);

 async function suggestFromCover(source: File | string) {
 setSuggesting(true);
 try {
 const result = await suggestThemeFromImage(source);
 setSuggestion(result);
 } finally {
 setSuggesting(false);
 }
 }

 function refresh() {
 void queryClient.invalidateQueries({ queryKey: ['wishlist', listId] });
 void queryClient.invalidateQueries({ queryKey: ['wishlists'] });
 }

 async function uploadCover(file: File) {
 if (typeof URL.createObjectURL === 'function') {
 setCoverPreview(URL.createObjectURL(file));
 }
 setCoverPending(true);
 try {
 const formData = new FormData();
 formData.append('file', file);
 const data = await apiUpload<WishlistResponse>(`/me/wishlists/${listId}/cover`, formData);
 setCoverPath(data.wishlist.coverPath ?? null);
 setCoverPreview(null);
 setCoverInputKey((key) => key + 1);
 onNotice({ kind: 'success', text: 'Обложка обновлена.' });
 refresh();
 // Предлагаем цветовую тему по загруженной обложке (не блокируя другие сообщения).
 void suggestFromCover(file);
 } catch (error) {
 onNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setCoverPending(false);
 }
 }

 async function deleteCover() {
 setCoverPending(true);
 try {
 const data = await apiDelete<WishlistResponse>(`/me/wishlists/${listId}/cover`);
 setCoverPath(data.wishlist.coverPath ?? null);
 setCoverPreview(null);
 setSuggestion(null);
 onNotice({ kind: 'success', text: 'Обложка удалена.' });
 refresh();
 } catch (error) {
 onNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setCoverPending(false);
 }
 }

 const previewSrc = coverPreview ?? coverPath;
 const previewTint = themeTint(themeColor, 0.12);
 const previewAccent = themeColor ? darkenThemeColor(themeColor) : '#c2410c';

 return (
 <fieldset className="rounded-2xl border border-line bg-card p-4">
 <legend className="px-1 text-sm font-semibold tracking-wide text-ink">Оформление</legend>

 <p className={FIELD_LABEL}>Цвет темы</p>
 <p className={HINT}>
 Цвет фона, шапки и акцентов страницы списка в редакторе и на публичной странице.
 «По умолчанию» — без акцента.
 </p>
 <div className="mt-3">
 <WishlistThemePicker value={themeColor} onChange={onThemeChange} disabled={coverPending} />
 </div>

 <p className="mt-5 text-sm font-semibold tracking-wide text-ink">Эмодзи-фон</p>
 <p className={HINT}>
 Крупные полупрозрачные эмодзи на фоне страницы списка. На чтение и кнопки не влияют.
 </p>
 <div className="mt-3">
 <WishlistEmojiPicker
 value={themeEmoji}
 onChange={onEmojiChange}
 disabled={coverPending}
 />
 </div>

 <div
 data-wl-preview="true"
 data-theme={themeColor ?? 'default'}
 className="mt-5 flex items-center gap-3 rounded-lg border border-line p-3"
 style={{ backgroundColor: previewTint ?? undefined }}
 >
 <span
 aria-hidden="true"
 className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line text-xl text-white"
 style={{ backgroundColor: previewAccent }}
 >
 {themeEmoji ?? '—'}
 </span>
 <span className="min-w-0">
 <span className="block truncate text-sm font-bold text-ink">
 {themeEmoji ? `Эмодзи ${themeEmoji}` : 'Без эмодзи'}
 </span>
 <span className="mt-0.5 block text-xs font-medium text-muted">Превью оформления списка</span>
 </span>
 </div>

 <p className="mt-5 text-sm font-semibold tracking-wide text-ink">Обложка</p>
 <p className={HINT}>
 Показывается шапкой над списком в редакторе и на публичной странице.
 </p>

 {previewSrc ? (
 <img
 src={previewSrc}
 alt="Обложка списка"
 className="mt-3 h-28 w-full rounded-lg border border-line object-cover md:h-36"
 />
 ) : null}

 {previewSrc ? (
 <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-sm">
 <span className="font-medium text-muted">Тема по обложке:</span>
 <Button
 type="button"
 size="sm"
 variant="secondary"
 disabled={suggesting || coverPending}
 onClick={() => void suggestFromCover(previewSrc)}
 >
 {suggesting ? 'Подбираю…' : 'Подобрать цвет'}
 </Button>
 {suggestion ? (
 <>
 <span
 aria-hidden="true"
 className="h-5 w-5 rounded-full border border-line"
 style={{ backgroundColor: suggestion.themeColor }}
 />
 <span className="text-xs font-semibold text-muted">{suggestion.themeColor}</span>
 {suggestion.themeColor !== themeColor ? (
 <Button type="button" size="sm" onClick={() => onThemeChange(suggestion.themeColor)}>
 Применить
 </Button>
 ) : null}
 </>
 ) : null}
 </div>
 ) : null}

 <div className="mt-3 flex flex-wrap items-center gap-2">
 <input
 key={coverInputKey}
 type="file"
 accept="image/*"
 aria-label="Файл обложки"
 className="sr-only"
 onChange={(event) => {
 const file = event.target.files?.[0];
 if (file) {
 void uploadCover(file);
 }
 event.target.value = '';
 }}
 />
 <button
 type="button"
 aria-label="Загрузить обложку"
 disabled={coverPending}
 onClick={(event) => {
 const input = event.currentTarget
 .parentElement?.querySelector<HTMLInputElement>('input[type="file"]');
 input?.click();
 }}
 className={[
 'nb-focus inline-flex min-h-11 items-center justify-center',
 'rounded-lg border border-ink bg-card px-3 text-sm font-bold text-ink',
 'hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60',
 ].join(' ')}
 >
 {coverPending ? 'Загрузка…' : 'Загрузить обложку'}
 </button>
 {coverPath ? (
 <button
 type="button"
 aria-label="Удалить обложку"
 disabled={coverPending}
 onClick={() => void deleteCover()}
 className={[
 'nb-focus inline-flex min-h-11 items-center justify-center',
 'rounded-lg border border-ink bg-card px-3 text-sm font-bold text-danger',
 'hover:bg-powder-soft disabled:cursor-not-allowed disabled:opacity-60',
 ].join(' ')}
 >
 Удалить обложку
 </button>
 ) : null}
 </div>
 </fieldset>
 );
}

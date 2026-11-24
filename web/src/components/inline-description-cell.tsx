import { useEffect, useRef } from 'react';
import { useInlineEdit } from '../hooks/use-inline-edit';

export interface InlineDescriptionCellProps {
 description: string | null;
 onSave: (description: string | null) => Promise<void>;
 onInvalid?: (message: string) => void;
}

/**
 * Колонка «Описание»: текст до 3 строк, клик → textarea.
 * Enter — сохранить, Shift+Enter — новая строка, Esc — отмена, blur — сохранить.
 */
export function InlineDescriptionCell({
 description,
 onSave,
 onInvalid,
}: InlineDescriptionCellProps) {
 const editor = useInlineEdit({
 value: description ?? '',
 onSave: async (next) => {
 const trimmed = next.trim();
 await onSave(trimmed === '' ? null : trimmed);
 },
 validate: (next) =>
 next.trim().length > 2000 ? 'Описание должно быть не длиннее 2000 символов.' : null,
 onInvalid,
 });
 const textareaRef = useRef<HTMLTextAreaElement>(null);

 useEffect(() => {
 if (editor.editing) {
 textareaRef.current?.focus();
 textareaRef.current?.select();
 }
 }, [editor.editing]);

 if (editor.editing) {
 return (
 <div>
 <textarea
 ref={textareaRef}
 aria-label="Описание подарка"
 rows={3}
 maxLength={2000}
 value={editor.draft}
 placeholder="Описание подарка"
 disabled={editor.pending}
 onChange={(event) => editor.setDraft(event.target.value)}
 onBlur={() => void editor.commit()}
 onKeyDown={(event) => {
 if (event.key === 'Enter' && !event.shiftKey) {
 event.preventDefault();
 void editor.commit();
 } else if (event.key === 'Escape') {
 event.preventDefault();
 editor.cancel();
 }
 }}
 className="min-h-16 w-full min-w-0 rounded-lg border border-accent bg-card px-2 py-1 text-sm text-ink focus:outline-none disabled:opacity-70"
 />
 {editor.pending ? <p className="mt-0.5 text-xs text-muted">Сохраняю…</p> : null}
 {editor.error ? (
 <p role="alert" className="mt-0.5 text-xs text-danger">
 {editor.error}
 </p>
 ) : null}
 </div>
 );
 }

 return (
 <button
 type="button"
 onClick={editor.start}
 className="-mx-1 flex min-h-9 w-full items-start rounded-lg px-1 text-left hover:bg-paper"
 >
 {description ? (
 <span className="line-clamp-3 whitespace-pre-line text-sm text-muted">{description}</span>
 ) : (
 <span className="text-sm text-muted/70">＋ описание</span>
 )}
 </button>
 );
}

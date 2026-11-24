import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useInlineEdit } from '../hooks/use-inline-edit';

export interface InlineTextCellProps {
 value: string;
 display: ReactNode;
 onSave: (next: string) => Promise<void>;
 ariaLabel: string;
 validate?: (next: string) => string | null;
 onInvalid?: (message: string) => void;
 type?: 'text' | 'url' | 'number';
 inputMode?: 'text' | 'decimal' | 'numeric' | 'url';
 placeholder?: string;
 maxLength?: number;
 title?: string;
 className?: string;
}

/** Ячейка таблицы, которая по клику становится полем ввода (Excel/Notion-стиль). */
export function InlineTextCell({
 value,
 display,
 onSave,
 ariaLabel,
 validate,
 onInvalid,
 type = 'text',
 inputMode,
 placeholder,
 maxLength,
 title,
 className,
}: InlineTextCellProps) {
 const editor = useInlineEdit({ value, onSave, validate, onInvalid });
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 if (editor.editing) {
 inputRef.current?.focus();
 inputRef.current?.select();
 }
 }, [editor.editing]);

 if (editor.editing) {
 return (
 <div className={className}>
 <input
 ref={inputRef}
 aria-label={ariaLabel}
 type={type}
 inputMode={inputMode}
 value={editor.draft}
 placeholder={placeholder}
 maxLength={maxLength}
 disabled={editor.pending}
 onChange={(event) => editor.setDraft(event.target.value)}
 onBlur={() => void editor.commit()}
 onKeyDown={(event) => {
 if (event.key === 'Enter') {
 event.preventDefault();
 void editor.commit();
 } else if (event.key === 'Escape') {
 event.preventDefault();
 editor.cancel();
 }
 }}
 className="min-h-9 w-full min-w-0 rounded-lg border border-accent bg-card px-2 py-1 text-sm text-ink focus:outline-none disabled:opacity-70"
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
 title={title}
 className={[
 '-mx-1 flex min-h-9 w-full items-center rounded-lg px-1 text-left hover:bg-paper',
 className ?? '',
 ]
 .join(' ')
 .trim()}
 >
 {display}
 </button>
 );
}

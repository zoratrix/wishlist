import { useEffect, useRef } from 'react';
import { priorityMeta } from '../lib/format';
import { useInlineEdit } from '../hooks/use-inline-edit';
import { PriorityMark } from './gift-badges';

const PRIORITIES = [1, 2, 3, 4, 5].map((value) => priorityMeta(value));

export interface InlinePriorityCellProps {
 priority: number;
 onSave: (priority: number) => Promise<void>;
 onInvalid?: (message: string) => void;
}

/** Приоритет прямо в ячейке: клик → select, Enter/blur — сохранить, Esc — отменить. */
export function InlinePriorityCell({ priority, onSave, onInvalid }: InlinePriorityCellProps) {
 const editor = useInlineEdit({
 value: String(priority),
 onSave: async (next) => {
 await onSave(Number(next));
 },
 validate: (next) => {
 const parsed = Number(next);
 return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5
 ? null
 : 'Приоритет — от 1 до 5.';
 },
 onInvalid,
 });
 const selectRef = useRef<HTMLSelectElement>(null);

 useEffect(() => {
 if (editor.editing) {
 selectRef.current?.focus();
 }
 }, [editor.editing]);

 if (editor.editing) {
 return (
 <div>
 <select
 ref={selectRef}
 aria-label="Приоритет подарка"
 value={editor.draft}
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
 className="min-h-9 w-full rounded-lg border border-accent bg-card px-2 py-1 text-sm text-ink focus:outline-none disabled:opacity-70"
 >
 {PRIORITIES.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
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
 className="-mx-1 flex min-h-9 w-full items-center rounded-lg px-1 text-left hover:bg-paper"
 >
 <PriorityMark priority={priority} />
 </button>
 );
}

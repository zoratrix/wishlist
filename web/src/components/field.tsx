import { useId } from 'react';
import type {
 InputHTMLAttributes,
 ReactNode,
 Ref,
 SelectHTMLAttributes,
 TextareaHTMLAttributes,
} from 'react';

// Поля с font-size 16px — iOS не зумит страницу при фокусе.
const INPUT_CLASS = [
 'w-full min-h-11 rounded-lg border border-ink bg-card px-3 py-2.5',
 'text-base text-ink',
 'placeholder:font-normal placeholder:text-muted',
 'transition-shadow focus:outline-none',
].join(' ');

const LABEL_CLASS = 'block text-[13px] font-medium text-ink';

interface FieldBase {
 label: string;
 hint?: ReactNode;
 error?: string | null;
 id?: string;
 className?: string;
}

function describedBy(ids: Array<string | undefined>): string | undefined {
 const value = ids.filter((item): item is string => Boolean(item)).join(' ');
 return value === '' ? undefined : value;
}

export interface TextFieldProps extends FieldBase, InputHTMLAttributes<HTMLInputElement> {
 /** Ссылка на input (например, для автофокуса из модалки). */
 inputRef?: Ref<HTMLInputElement>;
}

export function TextField({
 label,
 hint,
 error,
 id,
 className,
 inputRef,
 ...inputProps
}: TextFieldProps) {
 const generatedId = useId();
 const fieldId = id ?? generatedId;
 const hintId = hint ? `${fieldId}-hint` : undefined;
 const errorId = error ? `${fieldId}-error` : undefined;

 return (
 <div className={className}>
 <label htmlFor={fieldId} className={LABEL_CLASS}>
 {label}
 </label>
 <input
 id={fieldId}
 ref={inputRef}
 className={[INPUT_CLASS, error ? 'border-danger' : '', 'mt-1'].join(' ').trim()}
 aria-invalid={error ? true : undefined}
 aria-describedby={describedBy([hintId, errorId])}
 {...inputProps}
 />
 {hint ? (
 <p id={hintId} className="mt-1 text-xs font-medium text-muted">
 {hint}
 </p>
 ) : null}
 {error ? (
 <p id={errorId} role="alert" className="mt-1 text-sm font-semibold text-danger">
 {error}
 </p>
 ) : null}
 </div>
 );
}

export interface TextAreaFieldProps
 extends FieldBase,
 TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextAreaField({
 label,
 hint,
 error,
 id,
 className,
 ...areaProps
}: TextAreaFieldProps) {
 const generatedId = useId();
 const fieldId = id ?? generatedId;
 const hintId = hint ? `${fieldId}-hint` : undefined;
 const errorId = error ? `${fieldId}-error` : undefined;

 return (
 <div className={className}>
 <label htmlFor={fieldId} className={LABEL_CLASS}>
 {label}
 </label>
 <textarea
 id={fieldId}
 rows={3}
 className={[INPUT_CLASS, error ? 'border-danger' : '', 'mt-1 resize-y'].join(' ').trim()}
 aria-invalid={error ? true : undefined}
 aria-describedby={describedBy([hintId, errorId])}
 {...areaProps}
 />
 {hint ? (
 <p id={hintId} className="mt-1 text-xs font-medium text-muted">
 {hint}
 </p>
 ) : null}
 {error ? (
 <p id={errorId} role="alert" className="mt-1 text-sm font-semibold text-danger">
 {error}
 </p>
 ) : null}
 </div>
 );
}

export interface SelectFieldProps extends FieldBase, SelectHTMLAttributes<HTMLSelectElement> {
 children: ReactNode;
}

export function SelectField({
 label,
 hint,
 error,
 id,
 className,
 children,
 ...selectProps
}: SelectFieldProps) {
 const generatedId = useId();
 const fieldId = id ?? generatedId;

 return (
 <div className={className}>
 <label htmlFor={fieldId} className={LABEL_CLASS}>
 {label}
 </label>
 <select
 id={fieldId}
 className={[INPUT_CLASS, error ? 'border-danger' : '', 'mt-1'].join(' ').trim()}
 aria-invalid={error ? true : undefined}
 {...selectProps}
 >
 {children}
 </select>
 {hint ? <p className="mt-1 text-xs font-medium text-muted">{hint}</p> : null}
 {error ? (
 <p role="alert" className="mt-1 text-sm font-semibold text-danger">
 {error}
 </p>
 ) : null}
 </div>
 );
}

export interface CheckboxFieldProps {
 label: ReactNode;
 hint?: ReactNode;
 id?: string;
 checked: boolean;
 onChange: (checked: boolean) => void;
 disabled?: boolean;
 className?: string;
}

export function CheckboxField({
 label,
 hint,
 id,
 checked,
 onChange,
 disabled = false,
 className,
}: CheckboxFieldProps) {
 const generatedId = useId();
 const fieldId = id ?? generatedId;

 return (
 <div className={className}>
 <div className="flex items-start gap-3">
 {/* Зона нажатия 44×44, видимая рамка — 24×24. */}
 <span className="relative mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center">
 <input
 id={fieldId}
 type="checkbox"
 checked={checked}
 disabled={disabled}
 onChange={(event) => onChange(event.target.checked)}
 className="nb-check absolute -left-2.5 -top-2.5 z-10 h-11 w-11"
 />
 <span aria-hidden="true" className="nb-check-box">
 <svg
 viewBox="0 0 16 16"
 fill="none"
 stroke="currentColor"
 strokeWidth="2.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 className="h-4 w-4"
 >
 <path d="M3 8.5 6.5 12 13 4.5" />
 </svg>
 </span>
 </span>
 <label
 htmlFor={fieldId}
 className={[
 'flex min-h-11 min-w-0 flex-1 items-center text-sm font-medium text-ink',
 disabled ? 'opacity-60' : '',
 ]
 .join(' ')
 .trim()}
 >
 {label}
 </label>
 </div>
 {hint ? <p className="mt-1 pl-9 text-xs font-medium text-muted">{hint}</p> : null}
 </div>
 );
}

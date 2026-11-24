export interface EditGiftIconButtonProps {
 onClick: () => void;
 className?: string;
}

/** Маленькая иконка-карандаш (44px) — открывает модалку редактирования подарка. */
export function EditGiftIconButton({ onClick, className }: EditGiftIconButtonProps) {
 return (
 <button
 type="button"
 onClick={onClick}
 aria-label="Редактировать подарок"
 title="Редактировать"
 className={[
 'nb-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink',
 'bg-card text-ink',
 'transition-colors hover:bg-accent-soft active:translate-y-px',
 className ?? '',
 ]
 .join(' ')
 .trim()}
 >
 <svg
 aria-hidden="true"
 viewBox="0 0 20 20"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.8"
 strokeLinecap="round"
 strokeLinejoin="round"
 className="h-4 w-4"
 >
 <path d="M3.5 16.5h3l9-9a2.12 2.12 0 0 0-3-3l-9 9v3Z" />
 <path d="M11.5 5.5l3 3" />
 </svg>
 </button>
 );
}

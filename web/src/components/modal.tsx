import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Доп. кнопки в шапке (например, перестановка ↑/↓). */
  headerActions?: ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Модальное окно без внешних библиотек: закрывается по Esc и по клику мимо,
 * удерживает фокус на себе, на телефоне прижимается к низу (bottom sheet).
 * Необрутализм: чёрная рамка 2px, жёсткая тень, плотный оверлей без blur.
 */
export function Modal({ open, title, onClose, children, footer, headerActions, size = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      focusedRef.current = false;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Фокус ставим только при открытии, чтобы не красть его у полей
    // при повторных рендерах страницы.
    if (!focusedRef.current) {
      focusedRef.current = true;
      dialogRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,20,20,0.35)] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-ink bg-card p-5 nb-soft-shadow',
          'outline-none sm:rounded-3xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-lg font-semibold leading-tight text-ink"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className={[
                'nb-focus flex h-11 w-11 items-center justify-center rounded-full border border-line',
                'bg-card text-xl font-medium leading-none text-ink hover:bg-paper',
              ].join(' ')}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="mt-3">{children}</div>
        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </div>
  );
}

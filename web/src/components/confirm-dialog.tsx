import { Button } from './button';
import { Modal } from './modal';

export interface ConfirmDialogProps {
 open: boolean;
 title: string;
 message: string;
 confirmLabel?: string;
 cancelLabel?: string;
 pending?: boolean;
 onConfirm: () => void;
 onCancel: () => void;
}

/** Подтверждение опасного действия (удаление и т.п.). */
export function ConfirmDialog({
 open,
 title,
 message,
 confirmLabel = 'Удалить',
 cancelLabel = 'Отмена',
 pending = false,
 onConfirm,
 onCancel,
}: ConfirmDialogProps) {
 return (
 <Modal
 open={open}
 title={title}
 onClose={onCancel}
 footer={
 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
 <Button variant="secondary" onClick={onCancel} disabled={pending}>
 {cancelLabel}
 </Button>
 <Button variant="danger" onClick={onConfirm} loading={pending}>
 {confirmLabel}
 </Button>
 </div>
 }
 >
 {/* «Наклейка» с предупреждением: цветная подложка + чёрная рамка. */}
 <div className="flex items-start gap-2.5 rounded-2xl border border-ink bg-danger-soft p-3">
 <span
 aria-hidden="true"
 className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink bg-card text-xs font-semibold leading-none"
 >
 !
 </span>
 <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{message}</p>
 </div>
 </Modal>
 );
}

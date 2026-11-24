import { useState } from 'react';
import { errorMessage } from '../lib/api';
import type { FollowUserDTO } from '../lib/types';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { FollowUserRow } from './follow-user-row';
import { Notice } from './notice';
import { EmptyState, ErrorBlock, LoadingBlock } from './states';

export interface FollowListPageProps {
 title: string;
 description: string;
 emptyTitle: string;
 emptyDescription: string;
 actionLabel: string;
 confirmTitle: string;
 confirmMessage: (user: FollowUserDTO) => string;
 users: FollowUserDTO[];
 total: number;
 isLoading: boolean;
 errorText: string | null;
 onRetry: () => void;
 isActionPending: boolean;
 onAction: (user: FollowUserDTO) => Promise<void>;
}

/** Общий экран списка людей (подписчики/подписки). */
export function FollowListPage({
 title,
 description,
 emptyTitle,
 emptyDescription,
 actionLabel,
 confirmTitle,
 confirmMessage,
 users,
 total,
 isLoading,
 errorText,
 onRetry,
 isActionPending,
 onAction,
}: FollowListPageProps) {
 const [confirming, setConfirming] = useState<FollowUserDTO | null>(null);
 const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

 async function handleConfirm() {
 const user = confirming;
 if (!user) {
 return;
 }
 try {
 await onAction(user);
 setNotice({ kind: 'success', text: `Готово: ${user.displayName}.` });
 } catch (error) {
 setNotice({ kind: 'error', text: errorMessage(error) });
 } finally {
 setConfirming(null);
 }
 }

 return (
 <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 md:px-6 md:pt-6">
 <header>
 <div className="flex flex-wrap items-center gap-2">
 <h1 className="text-3xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-4xl">
 {title}
 </h1>
 <span className="inline-flex min-h-8 items-center rounded-md border border-line bg-butter-soft px-2 text-sm font-semibold text-ink">
 {total}
 </span>
 </div>
 <p className="mt-2 text-sm font-medium text-muted">{description}</p>
 </header>

 {notice ? (
 <div className="mt-4">
 <Notice kind={notice.kind} onClose={() => setNotice(null)}>
 {notice.text}
 </Notice>
 </div>
 ) : null}

 <div className="mt-5">
 {isLoading ? (
 <LoadingBlock rows={3} />
 ) : errorText !== null ? (
 <ErrorBlock message={errorText} onRetry={onRetry} />
 ) : users.length === 0 ? (
 <EmptyState title={emptyTitle} description={emptyDescription} />
 ) : (
 <ul className="space-y-3">
 {users.map((user) => (
 <FollowUserRow
 key={user.id}
 user={user}
 action={
 <Button variant="secondary" size="sm" onClick={() => setConfirming(user)}>
 {actionLabel}
 </Button>
 }
 />
 ))}
 </ul>
 )}
 </div>

 <ConfirmDialog
 open={confirming !== null}
 title={confirmTitle}
 message={confirming === null ? '' : confirmMessage(confirming)}
 confirmLabel={actionLabel}
 pending={isActionPending}
 onCancel={() => setConfirming(null)}
 onConfirm={() => void handleConfirm()}
 />
 </div>
 );
}

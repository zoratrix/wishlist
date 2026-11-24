import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUpload, errorMessage } from '../lib/api';
import type { AuthResponse, UserSelfDTO } from '../lib/types';
import { meQueryKey } from '../hooks/use-auth';
import { Button } from './button';
import { Notice } from './notice';
import { UserAvatar } from './user-avatar';

/** Загрузка аватара: file input, локальное превью, multipart POST /api/me/avatar. */
export function AvatarUpload({ user }: { user: UserSelfDTO }) {
 const queryClient = useQueryClient();
 const inputRef = useRef<HTMLInputElement>(null);
 const [preview, setPreview] = useState<string | null>(null);
 const [pending, setPending] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [saved, setSaved] = useState(false);

 async function upload(file: File) {
 setError(null);
 setSaved(false);

 if (typeof URL.createObjectURL === 'function') {
 setPreview(URL.createObjectURL(file));
 }

 setPending(true);
 try {
 const formData = new FormData();
 formData.append('file', file);
 const data = await apiUpload<AuthResponse>('/me/avatar', formData);
 queryClient.setQueryData(meQueryKey, { user: data.user });
 void queryClient.invalidateQueries({ queryKey: meQueryKey });
 setSaved(true);
 } catch (uploadError) {
 setError(errorMessage(uploadError));
 } finally {
 setPending(false);
 }
 }

 return (
 <section className="nb-card p-4">
 <h2 className="text-lg font-semibold leading-tight text-ink">Аватар</h2>
 <div className="mt-3 flex flex-wrap items-center gap-4">
 {preview ? (
 <img
 src={preview}
 alt="Предпросмотр аватара"
 className="h-20 w-20 shrink-0 rounded-full border border-line bg-card object-cover"
 />
 ) : (
 <UserAvatar
 name={user.displayName}
 username={user.username}
 avatarPath={user.avatarPath}
 size="lg"
 />
 )}

 <div className="min-w-0">
 <input
 ref={inputRef}
 type="file"
 accept="image/*"
 aria-label="Файл аватара"
 className="sr-only"
 onChange={(event) => {
 const file = event.target.files?.[0];
 if (file) {
 void upload(file);
 }
 event.target.value = '';
 }}
 />
 <Button
 type="button"
 variant="secondary"
 size="sm"
 loading={pending}
 onClick={() => inputRef.current?.click()}
 >
 Загрузить аватар
 </Button>
 <p className="mt-2 text-xs font-medium text-muted">
 JPG, PNG или WebP. Картинка обрежется до квадрата.
 </p>
 {saved ? (
 <p
 role="status"
 className="mt-2 inline-flex items-center gap-1 rounded-md border border-line bg-mint-soft px-2 py-1 text-xs font-bold text-ink"
 >
 <span aria-hidden="true">✓</span>
 Аватар обновлён.
 </p>
 ) : null}
 </div>
 </div>

 {error ? (
 <div className="mt-3">
 <Notice kind="error" onClose={() => setError(null)}>
 {error}
 </Notice>
 </div>
 ) : null}
 </section>
 );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, errorMessage, ApiError } from '../lib/api';
import type { Visibility, WishlistResponse, WishlistSummaryDTO } from '../lib/types';
import { Button } from './button';
import { SelectField, TextField } from './field';
import { Modal } from './modal';
import { Notice } from './notice';

interface CreateWishlistModalProps {
 open: boolean;
 onClose: () => void;
 onCreated: (wishlist: WishlistSummaryDTO) => void;
}

/** Создание вишлиста: название, дата события, видимость. */
export function CreateWishlistModal({ open, onClose, onCreated }: CreateWishlistModalProps) {
 const queryClient = useQueryClient();
 const [title, setTitle] = useState('');
 const [eventDate, setEventDate] = useState('');
 const [visibility, setVisibility] = useState<Visibility>('link');
 const [formError, setFormError] = useState<string | null>(null);
 const [titleError, setTitleError] = useState<string | null>(null);

 const createMutation = useMutation<WishlistResponse, ApiError, Record<string, unknown>>({
 mutationFn: (payload) => apiPost<WishlistResponse>('/me/wishlists', payload),
 onSuccess: (data) => {
 void queryClient.invalidateQueries({ queryKey: ['wishlists'] });
 setTitle('');
 setEventDate('');
 setVisibility('link');
 setFormError(null);
 setTitleError(null);
 onCreated(data.wishlist);
 },
 onError: (error) => {
 setFormError(errorMessage(error));
 },
 });

 function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFormError(null);

 if (title.trim() === '') {
 setTitleError('Введите название списка.');
 return;
 }
 setTitleError(null);

 createMutation.mutate({
 title: title.trim(),
 eventDate: eventDate === '' ? null : eventDate,
 visibility,
 });
 }

 return (
 <Modal open={open} title="Новый список" onClose={onClose}>
 <form className="space-y-4" onSubmit={handleSubmit} noValidate>
 {formError ? <Notice kind="error">{formError}</Notice> : null}

 <TextField
 label="Название"
 name="title"
 value={title}
 maxLength={100}
 onChange={(event) => setTitle(event.target.value)}
 placeholder="Например, День рождения"
 error={titleError}
 autoFocus
 />

 <TextField
 label="Дата события"
 type="date"
 name="eventDate"
 value={eventDate}
 onChange={(event) => setEventDate(event.target.value)}
 hint="Необязательно. Поможет гостям выбрать подарок вовремя."
 />

 <SelectField
 label="Кто увидит список"
 name="visibility"
 value={visibility}
 onChange={(event) => setVisibility(event.target.value as Visibility)}
 hint="Ссылку можно отправить кому угодно — регистрация гостю не нужна."
 >
 <option value="link">По ссылке</option>
 <option value="public">Публичный</option>
 </SelectField>

 <Button type="submit" className="w-full" loading={createMutation.isPending}>
 Создать список
 </Button>
 </form>
 </Modal>
 );
}

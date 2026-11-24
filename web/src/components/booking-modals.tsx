import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, ApiError, errorMessage } from '../lib/api';
import type { BookGiftResponse, GiftDTO, UnbookGiftResponse } from '../lib/types';
import { Button } from './button';
import { TextField } from './field';
import { Modal } from './modal';
import { Notice } from './notice';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BookedGuestData {
 name: string;
 email: string;
}

export interface BookGiftModalProps {
 token: string;
 gift: GiftDTO | null;
 onClose: () => void;
 onBooked: (data: BookedGuestData) => void;
}

/** Гостевое бронирование: имя + email, одна кнопка, без регистрации. */
export function BookGiftModal({ token, gift, onClose, onBooked }: BookGiftModalProps) {
 const queryClient = useQueryClient();
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [formError, setFormError] = useState<string | null>(null);
 const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

 const mutation = useMutation<
 BookGiftResponse,
 ApiError,
 BookedGuestData
 >({
 mutationFn: (payload) =>
 apiPost<BookGiftResponse>(
 `/w/${encodeURIComponent(token)}/gifts/${encodeURIComponent(gift?.id ?? '')}/book`,
 payload,
 ),
 onSuccess: (_data, variables) => {
 void queryClient.invalidateQueries({ queryKey: ['public-wishlist', token] });
 onBooked(variables);
 },
 onError: (error) => setFormError(errorMessage(error)),
 });

 function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFormError(null);

 const errors: { name?: string; email?: string } = {};
 if (name.trim() === '') {
 errors.name = 'Как вас зовут? Имя увидит только владелец списка.';
 }
 if (!EMAIL_PATTERN.test(email.trim())) {
 errors.email = 'Укажите email — он нужен, чтобы отменить бронь.';
 }
 setFieldErrors(errors);
 if (Object.keys(errors).length > 0) {
 return;
 }

 mutation.mutate({ name: name.trim(), email: email.trim() });
 }

 return (
 <Modal open={gift !== null} title="Забронировать подарок" onClose={onClose}>
 <div className="rounded-lg border border-line bg-butter-soft p-3">
 <p className="text-sm font-semibold leading-snug text-ink">
 «{gift?.title ?? ''}» — после брони его увидят занятым другие гости.
 </p>
 </div>

 <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
 {formError ? <Notice kind="error">{formError}</Notice> : null}

 <TextField
 label="Ваше имя"
 name="name"
 autoComplete="name"
 value={name}
 onChange={(event) => setName(event.target.value)}
 error={fieldErrors.name}
 maxLength={100}
 />

 <TextField
 label="Электронная почта"
 type="email"
 name="email"
 inputMode="email"
 autoComplete="email"
 value={email}
 onChange={(event) => setEmail(event.target.value)}
 hint="Email нужен только для отмены брони и хранится только в этом браузере."
 error={fieldErrors.email}
 />

 <Button type="submit" className="w-full" loading={mutation.isPending}>
 Забронировать
 </Button>
 </form>
 </Modal>
 );
}

export interface UnbookGiftModalProps {
 token: string;
 gift: GiftDTO | null;
 /** Email из локальной отметки «Забронировано вами» — поле остаётся редактируемым. */
 initialEmail?: string;
 onClose: () => void;
 onUnbooked: () => void;
}

/** Отмена брони: тот же email, что указывали при бронировании. */
export function UnbookGiftModal({
 token,
 gift,
 initialEmail = '',
 onClose,
 onUnbooked,
}: UnbookGiftModalProps) {
 const queryClient = useQueryClient();
 const [email, setEmail] = useState(initialEmail);
 const [formError, setFormError] = useState<string | null>(null);
 const [fieldError, setFieldError] = useState<string | null>(null);

 // Каждое открытие окна — чистое состояние с подставленным email (если он есть).
 useEffect(() => {
 if (gift === null) {
 return;
 }
 setEmail(initialEmail);
 setFormError(null);
 setFieldError(null);
 }, [gift, initialEmail]);

 const mutation = useMutation<UnbookGiftResponse, ApiError, { email: string }>({
 mutationFn: (payload) =>
 apiPost<UnbookGiftResponse>(
 `/w/${encodeURIComponent(token)}/gifts/${encodeURIComponent(gift?.id ?? '')}/unbook`,
 payload,
 ),
 onSuccess: () => {
 void queryClient.invalidateQueries({ queryKey: ['public-wishlist', token] });
 onUnbooked();
 },
 onError: (error) => setFormError(errorMessage(error)),
 });

 function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFormError(null);

 if (!EMAIL_PATTERN.test(email.trim())) {
 setFieldError('Укажите email, который вы оставили при бронировании.');
 return;
 }
 setFieldError(null);
 mutation.mutate({ email: email.trim() });
 }

 return (
 <Modal open={gift !== null} title="Отменить бронирование" onClose={onClose}>
 <div className="rounded-lg border border-line bg-powder-soft p-3">
 <p className="text-sm font-semibold leading-snug text-ink">
 «{gift?.title ?? ''}» снова станет свободным. Введите email, который указывали при
 бронировании.
 </p>
 </div>

 <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
 {formError ? <Notice kind="error">{formError}</Notice> : null}

 <TextField
 label="Электронная почта"
 type="email"
 name="email"
 inputMode="email"
 autoComplete="email"
 value={email}
 onChange={(event) => setEmail(event.target.value)}
 error={fieldError}
 />

 <Button type="submit" variant="danger" className="w-full" loading={mutation.isPending}>
 Отменить бронирование
 </Button>
 </form>
 </Modal>
 );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { Button } from '../components/button';
import { CheckboxField, TextField } from '../components/field';
import { Notice } from '../components/notice';
import { BrandSticker } from '../components/site-header';
import { useRegister } from '../hooks/use-auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

interface FieldErrors {
 email?: string;
 password?: string;
 displayName?: string;
 username?: string;
}

function registerErrorMessage(error: unknown): string {
 if (error instanceof ApiError) {
 return error.message;
 }
 return 'Не удалось создать аккаунт. Попробуйте ещё раз.';
}

export default function RegisterPage() {
 const register = useRegister();
 const navigate = useNavigate();

 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [displayName, setDisplayName] = useState('');
 const [username, setUsername] = useState('');
 const [emailNotifications, setEmailNotifications] = useState(true);
 const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
 const [formError, setFormError] = useState<string | null>(null);

 function validate(): FieldErrors {
 const errors: FieldErrors = {};
 if (!EMAIL_PATTERN.test(email.trim())) {
 errors.email = 'Укажите email, например anna@example.com.';
 }
 if (password.length < 8) {
 errors.password = 'Пароль должен быть не короче 8 символов.';
 }
 if (displayName.trim() === '') {
 errors.displayName = 'Как вас зовут? Имя увидят гости.';
 }
 if (!USERNAME_PATTERN.test(username.trim())) {
 errors.username = 'Логин: 3–20 символов, только a–z, 0–9 и «_».';
 }
 return errors;
 }

 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFormError(null);

 const errors = validate();
 setFieldErrors(errors);
 if (Object.keys(errors).length > 0) {
 return;
 }

 try {
 await register.mutateAsync({
 email: email.trim(),
 password,
 displayName: displayName.trim(),
 username: username.trim().toLowerCase(),
 emailNotifications,
 });
 navigate('/app', { replace: true });
 } catch (error) {
 setFormError(registerErrorMessage(error));
 }
 }

 return (
 <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-12 pt-5">
 <div className="flex items-center justify-between gap-2">
 <BrandSticker />
 <Link
 to="/"
 className="nb-focus inline-flex min-h-11 items-center text-sm font-bold text-ink hover:underline"
 >
 ← На главную
 </Link>
 </div>

 <div className="nb-card mt-5 p-5 sm:p-6">
 <h1 className="text-3xl font-semibold leading-none tracking-tight text-ink">
 Регистрация
 </h1>
 <p className="mt-2 text-sm font-medium text-muted">
 Создайте аккаунт — это займёт полминуты.
 </p>

 <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
 {formError ? (
 <Notice kind="error" onClose={() => setFormError(null)}>
 {formError}
 </Notice>
 ) : null}

 <TextField
 label="Email"
 type="email"
 name="email"
 autoComplete="email"
 inputMode="email"
 value={email}
 onChange={(event) => setEmail(event.target.value)}
 error={fieldErrors.email}
 />

 <TextField
 label="Пароль"
 type="password"
 name="password"
 autoComplete="new-password"
 value={password}
 onChange={(event) => setPassword(event.target.value)}
 hint="Не короче 8 символов."
 error={fieldErrors.password}
 />

 <TextField
 label="Имя"
 name="displayName"
 autoComplete="name"
 value={displayName}
 onChange={(event) => setDisplayName(event.target.value)}
 hint="Так вас увидят гости вишлистов."
 error={fieldErrors.displayName}
 />

 <TextField
 label="Логин"
 name="username"
 autoComplete="username"
 autoCapitalize="none"
 spellCheck={false}
 value={username}
 onChange={(event) => setUsername(event.target.value.toLowerCase())}
 hint="3–20 символов: латинские буквы, цифры и «_». Нужен для ссылки на профиль."
 error={fieldErrors.username}
 />

 <CheckboxField
 label="Присылать уведомления на почту"
 hint="Важные события: бронирования, напоминания. Можно отключить."
 checked={emailNotifications}
 onChange={setEmailNotifications}
 />

 <Button type="submit" className="w-full" loading={register.isPending}>
 Зарегистрироваться
 </Button>
 </form>
 </div>

 <p className="mt-5 text-sm font-medium text-muted">
 Уже есть аккаунт?{' '}
 <Link to="/login" className="font-bold text-ink underline decoration-2 underline-offset-2">
 Войти
 </Link>
 </p>
 </main>
 );
}

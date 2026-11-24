import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { Button } from '../components/button';
import { TextField } from '../components/field';
import { Notice } from '../components/notice';
import { BrandSticker } from '../components/site-header';
import { useLogin } from '../hooks/use-auth';

function loginErrorMessage(error: unknown): string {
 if (error instanceof ApiError) {
 if (error.status === 401) {
 return 'Неверный email или пароль.';
 }
 return error.message;
 }
 return 'Не удалось войти. Попробуйте ещё раз.';
}

export default function LoginPage() {
 const login = useLogin();
 const navigate = useNavigate();
 const location = useLocation();
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [formError, setFormError] = useState<string | null>(null);

 const state = location.state as { from?: unknown } | null;
 const redirectTo = typeof state?.from === 'string' ? state.from : '/app';

 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFormError(null);

 if (email.trim() === '' || password === '') {
 setFormError('Введите email и пароль.');
 return;
 }

 try {
 await login.mutateAsync({ email: email.trim(), password });
 navigate(redirectTo, { replace: true });
 } catch (error) {
 setFormError(loginErrorMessage(error));
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
 <h1 className="text-3xl font-semibold leading-none tracking-tight text-ink">Вход</h1>
 <p className="mt-2 text-sm font-medium text-muted">
 Войдите, чтобы открыть свои списки желаний.
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
 />

 <TextField
 label="Пароль"
 type="password"
 name="password"
 autoComplete="current-password"
 value={password}
 onChange={(event) => setPassword(event.target.value)}
 />

 <div className="-mt-2 flex justify-end">
 <Link
 to="/forgot-password"
 className="nb-focus inline-flex min-h-11 items-center text-sm font-bold text-ink underline decoration-2 underline-offset-2"
 >
 Забыли пароль?
 </Link>
 </div>

 <Button type="submit" className="w-full" loading={login.isPending}>
 Войти
 </Button>
 </form>
 </div>

 <p className="mt-5 text-sm font-medium text-muted">
 Нет аккаунта?{' '}
 <Link to="/register" className="font-bold text-ink underline decoration-2 underline-offset-2">
 Зарегистрироваться
 </Link>
 </p>
 </main>
 );
}

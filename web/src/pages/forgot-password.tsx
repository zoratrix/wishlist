import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { Button } from '../components/button';
import { TextField } from '../components/field';
import { Notice } from '../components/notice';
import { BrandSticker } from '../components/site-header';
import { useForgotPassword } from '../hooks/use-password-reset';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Нейтральный ответ: он одинаковый для существующего и несуществующего email. */
const SUCCESS_TEXT = 'Если такой email есть, мы отправили ссылку. Проверьте почту.';

function forgotErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Не удалось отправить ссылку. Попробуйте ещё раз.';
}

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError('Укажите email, например anna@example.com.');
      return;
    }

    try {
      const result = await forgot.mutateAsync({ email: email.trim() });
      setDebugUrl(result?.debugUrl ?? null);
      setSent(true);
    } catch (error) {
      setFormError(forgotErrorMessage(error));
    }
  }

  function handleRetry() {
    forgot.reset();
    setSent(false);
    setDebugUrl(null);
    setFormError(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-12 pt-5">
      <div className="flex items-center justify-between gap-2">
        <BrandSticker />
        <Link
          to="/login"
          className="nb-focus inline-flex min-h-11 items-center text-sm font-bold text-ink hover:underline"
        >
          ← Войти
        </Link>
      </div>

      <div className="nb-card mt-5 p-5 sm:p-6">
        <h1 className="text-3xl font-semibold leading-none tracking-tight text-ink">
          Восстановление пароля
        </h1>
        <p className="mt-2 text-sm font-medium text-muted">
          Укажите email аккаунта — мы отправим ссылку для сброса пароля.
        </p>

        {sent ? (
          <div className="mt-5 space-y-4">
            <Notice kind="success">{SUCCESS_TEXT}</Notice>

            {debugUrl ? (
              <div className="rounded-2xl border border-ink bg-butter-soft p-3.5 text-sm text-ink">
                <p className="font-semibold">Локальный режим</p>
                <p className="mt-1 text-ink/80">
                  SMTP не настроен, письмо не ушло. Ссылку можно открыть напрямую:
                </p>
                <a
                  href={debugUrl}
                  className="nb-focus mt-2 inline-flex min-h-11 items-center break-all font-bold underline decoration-2 underline-offset-2"
                >
                  открыть ссылку сброса
                </a>
              </div>
            ) : null}

            <p className="text-sm font-medium text-muted">
              Письмо может прийти не сразу — загляните в папку «Спам».
            </p>

            <Button variant="secondary" className="w-full" onClick={handleRetry}>
              Отправить ещё раз
            </Button>
          </div>
        ) : (
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
              hint="Тот адрес, на который зарегистрирован аккаунт."
              error={fieldError}
            />

            <Button type="submit" className="w-full" loading={forgot.isPending}>
              Отправить ссылку
            </Button>
          </form>
        )}
      </div>

      <p className="mt-5 text-sm font-medium text-muted">
        Нет аккаунта?{' '}
        <Link
          to="/register"
          className="nb-focus font-bold text-ink underline decoration-2 underline-offset-2"
        >
          Создать аккаунт
        </Link>
      </p>
    </main>
  );
}

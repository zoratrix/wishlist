import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { Button, buttonClasses } from '../components/button';
import { TextField } from '../components/field';
import { Notice } from '../components/notice';
import { BrandSticker } from '../components/site-header';
import { useResetPassword } from '../hooks/use-password-reset';

const INVALID_TOKEN_TEXT = 'Ссылка недействительна или устарела. Запросите новую.';

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

/**
 * Сервер отвечает 400 INVALID_RESET_TOKEN для неверного, просроченного или уже
 * использованного токена — показываем человеку понятный следующий шаг.
 */
function resetErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_RESET_TOKEN') {
      return INVALID_TOKEN_TEXT;
    }
    return error.message;
  }
  return 'Не удалось сохранить пароль. Попробуйте ещё раз.';
}

export default function ResetPasswordPage() {
  const reset = useResetPassword();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors: FieldErrors = {};
    if (password.length < 8) {
      errors.password = 'Пароль должен быть не короче 8 символов.';
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Пароли не совпадают.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await reset.mutateAsync({ token, password });
      setDone(true);
    } catch (error) {
      setFormError(resetErrorMessage(error));
    }
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
          Сброс пароля
        </h1>

        {token === '' ? (
          <div className="mt-5 space-y-4">
            <Notice kind="error">{INVALID_TOKEN_TEXT}</Notice>
            <p className="text-sm font-medium text-muted">
              Ссылку из письма можно использовать только один раз. Запросите новую — это
              займёт минуту.
            </p>
            <Link
              to="/forgot-password"
              className={[buttonClasses('primary', 'md'), 'w-full'].join(' ')}
            >
              Запросить новую ссылку
            </Link>
          </div>
        ) : done ? (
          <div className="mt-5 space-y-4">
            <Notice kind="success">Пароль изменён</Notice>
            <p className="text-sm font-medium text-muted">
              Теперь можно войти в аккаунт с новым паролем.
            </p>
            <Link
              to="/login"
              className={[buttonClasses('primary', 'md'), 'w-full'].join(' ')}
            >
              Войти
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm font-medium text-muted">
              Придумайте новый пароль для входа в аккаунт.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
              {formError ? (
                <Notice kind="error" onClose={() => setFormError(null)}>
                  {formError}
                </Notice>
              ) : null}

              <TextField
                label="Новый пароль"
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                hint="Не короче 8 символов."
                error={fieldErrors.password}
              />

              <TextField
                label="Повторите пароль"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={fieldErrors.confirmPassword}
              />

              <Button type="submit" className="w-full" loading={reset.isPending}>
                Сохранить пароль
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

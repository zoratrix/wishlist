import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { ApiError } from '../lib/api';

export interface ForgotPasswordInput {
  email: string;
}

/** Ответ всегда содержит ok; в dev без SMTP приходит debugUrl на сброс. */
export interface ForgotPasswordResult {
  ok: true;
  debugUrl?: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

/** Запрос письма со ссылкой сброса (сервер не раскрывает, есть ли аккаунт). */
export function useForgotPassword() {
  return useMutation<ForgotPasswordResult, ApiError, ForgotPasswordInput>({
    mutationFn: (input) => apiPost<ForgotPasswordResult>('/auth/forgot-password', input),
  });
}

/** Установка нового пароля по одноразовому токену из письма. */
export function useResetPassword() {
  return useMutation<void, ApiError, ResetPasswordInput>({
    mutationFn: (input) => apiPost<void>('/auth/reset-password', input),
  });
}

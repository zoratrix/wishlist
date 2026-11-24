import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, ApiError } from '../lib/api';
import type { AuthResponse, MeResponse, UserSelfDTO } from '../lib/types';

export const meQueryKey = ['auth', 'me'] as const;

export interface AuthState {
  user: UserSelfDTO | null;
  isLoading: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/** Текущий пользователь: GET /api/auth/me (сервер сам решает, есть ли сессия). */
export function useAuth(): AuthState {
  const query = useQuery<MeResponse, ApiError>({
    queryKey: meQueryKey,
    queryFn: () => apiGet<MeResponse>('/auth/me'),
    staleTime: 15_000,
  });

  return {
    user: query.data?.user ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  username: string;
  emailNotifications: boolean;
}

/** Вход. После успеха обновляет кэш пользователя и перепроверяет его. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, ApiError, LoginInput>({
    mutationFn: (input) => apiPost<AuthResponse>('/auth/login', input),
    onSuccess: (data) => {
      queryClient.setQueryData(meQueryKey, { user: data.user });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

/** Регистрация: сервер сразу создаёт сессию. */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation<AuthResponse, ApiError, RegisterInput>({
    mutationFn: (input) => apiPost<AuthResponse>('/auth/register', input),
    onSuccess: (data) => {
      queryClient.setQueryData(meQueryKey, { user: data.user });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

/** Выход: сессия закрывается на сервере, кэш текущего пользователя сбрасывается. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => apiPost<void>('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(meQueryKey, { user: null });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
    onError: () => {
      // Даже если сервер недоступен, пользователь должен выйти из интерфейса.
      queryClient.setQueryData(meQueryKey, { user: null });
    },
  });
}

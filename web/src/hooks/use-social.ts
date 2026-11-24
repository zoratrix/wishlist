import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, ApiError } from '../lib/api';
import type {
  FollowListResponse,
  FollowToggleResponse,
  PublicProfileResponse,
} from '../lib/types';
import { meQueryKey } from './use-auth';

/** Публичный профиль пользователя (GET /api/users/:username). */
export function usePublicProfile(username: string) {
  return useQuery<PublicProfileResponse, ApiError>({
    queryKey: ['profile', username],
    queryFn: () => apiGet<PublicProfileResponse>(`/users/${encodeURIComponent(username)}`),
    enabled: username !== '',
  });
}

/** Подписка/отписка на пользователя; состояние обновляется в кэше профиля. */
export function useFollowToggle(username: string) {
  const queryClient = useQueryClient();

  return useMutation<FollowToggleResponse, ApiError, 'follow' | 'unfollow'>({
    mutationFn: (action) =>
      action === 'follow'
        ? apiPost<FollowToggleResponse>(`/users/${encodeURIComponent(username)}/follow`)
        : apiDelete<FollowToggleResponse>(`/users/${encodeURIComponent(username)}/follow`),
    onSuccess: (data) => {
      queryClient.setQueryData<PublicProfileResponse>(['profile', username], (current) =>
        current === undefined
          ? current
          : { ...current, viewer: { ...current.viewer, isFollowing: data.isFollowing } },
      );
      void queryClient.invalidateQueries({ queryKey: ['profile', username] });
      // Публичный вишлист показывает подписку в шапке — обновляем и его.
      void queryClient.invalidateQueries({ queryKey: ['public-wishlist'] });
      void queryClient.invalidateQueries({ queryKey: ['followers'] });
      void queryClient.invalidateQueries({ queryKey: ['following'] });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

export function useFollowers() {
  return useQuery<FollowListResponse, ApiError>({
    queryKey: ['followers'],
    queryFn: () => apiGet<FollowListResponse>('/me/followers'),
  });
}

export function useFollowing() {
  return useQuery<FollowListResponse, ApiError>({
    queryKey: ['following'],
    queryFn: () => apiGet<FollowListResponse>('/me/following'),
  });
}

/** Владелец удаляет подписчика. */
export function useRemoveFollower() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (userId) => apiDelete(`/me/followers/${encodeURIComponent(userId)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['followers'] });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

/** Отписка от пользователя из списка «Мои подписки». */
export function useUnfollowUser() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (username) =>
      apiDelete(`/users/${encodeURIComponent(username)}/follow`),
    onSuccess: (_data, username) => {
      void queryClient.invalidateQueries({ queryKey: ['following'] });
      void queryClient.invalidateQueries({ queryKey: ['followers'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', username] });
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

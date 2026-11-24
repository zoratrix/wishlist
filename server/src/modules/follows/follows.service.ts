import { getDb } from '../../db/index.ts';
import { AppError, NotFoundError } from '../../errors.ts';
import { newId } from '../../lib/crypto.ts';
import { isUniqueConstraintError } from '../../lib/db-errors.ts';
import { toFollowUserDTO } from '../../lib/dto.ts';
import type { FollowCounts, FollowUserDTO, ProfileViewerDTO } from '../../lib/dto.ts';
import type { FollowUserRow, UserRow } from '../../lib/rows.ts';

/** Подписан ли `followerId` на `followingId`. */
export function isFollowing(followerId: string, followingId: string): boolean {
  return (
    getDb()
      .prepare('SELECT 1 AS found FROM follows WHERE follower_id = ? AND following_id = ?')
      .get(followerId, followingId) !== undefined
  );
}

/**
 * Отношение смотрящего к профилю — одно правило для публичного профиля и
 * гостевой страницы вишлиста: isSelf, уже подписан, можно ли подписаться.
 * Подписка возможна только при входе, не на себя и только на открытый профиль.
 */
export function getProfileViewer(profile: UserRow, viewerId: string | null): ProfileViewerDTO {
  const isSelf = viewerId !== null && viewerId === profile.id;
  const isFollowingViewer = viewerId !== null && !isSelf && isFollowing(viewerId, profile.id);
  const canFollow =
    viewerId !== null && !isSelf && profile.is_profile_public === 1 && !isFollowingViewer;
  return { isSelf, isFollowing: isFollowingViewer, canFollow };
}

/** Счётчики подписок — только для UserSelfDTO (владелец аккаунта). */
export function getUserFollowCounts(userId: string): FollowCounts {
  const row = getDb()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers_count,
         (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following_count`,
    )
    .get(userId, userId) as { followers_count: number; following_count: number };
  return { followersCount: row.followers_count, followingCount: row.following_count };
}

/**
 * Подписка односторонняя и идемпотентна: повторный POST не создаёт дубль.
 * На себя нельзя (400), на закрытый профиль нельзя (404, как «недоступно»).
 */
export function followUser(target: UserRow, followerId: string): void {
  if (target.id === followerId) {
    throw new AppError(400, 'CANNOT_FOLLOW_SELF', 'Нельзя подписаться на самого себя.');
  }
  if (target.is_profile_public !== 1) throw new NotFoundError();

  try {
    getDb()
      .prepare('INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)')
      .run(newId(), followerId, target.id, new Date().toISOString());
  } catch (error) {
    // Уже подписан — это не ошибка, просто ничего не меняем.
    if (isUniqueConstraintError(error)) return;
    throw error;
  }
}

/** Отписка идемпотентна; на закрытый профиль отписаться можно всегда. */
export function unfollowUser(targetId: string, followerId: string): void {
  getDb()
    .prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
    .run(followerId, targetId);
}

/** Подписчики пользователя (кто на него подписан), свежие сверху. */
export function listFollowers(userId: string): FollowUserDTO[] {
  const rows = getDb()
    .prepare(
      `SELECT u.*, f.created_at AS followed_at
         FROM follows f
         JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = ?
        ORDER BY f.created_at DESC, u.id`,
    )
    .all(userId) as FollowUserRow[];
  return rows.map(toFollowUserDTO);
}

/** Подписки пользователя (на кого он подписан), свежие сверху. */
export function listFollowing(userId: string): FollowUserDTO[] {
  const rows = getDb()
    .prepare(
      `SELECT u.*, f.created_at AS followed_at
         FROM follows f
         JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC, u.id`,
    )
    .all(userId) as FollowUserRow[];
  return rows.map(toFollowUserDTO);
}

/** Владелец удаляет подписчика. Нет такой подписки/чужой → 404. */
export function removeFollower(ownerId: string, followerId: string): void {
  const result = getDb()
    .prepare('DELETE FROM follows WHERE following_id = ? AND follower_id = ?')
    .run(ownerId, followerId);
  if (result.changes === 0) throw new NotFoundError();
}

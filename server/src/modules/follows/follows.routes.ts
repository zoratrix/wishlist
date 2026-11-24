import { Router } from 'express';
import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors.ts';
import { pathParam } from '../../lib/http.ts';
import { requireViewer } from '../../lib/session.ts';
import type { UserRow } from '../../lib/rows.ts';
import { findUserByUsername } from '../users/users.service.ts';
import {
  followUser,
  listFollowers,
  listFollowing,
  removeFollower,
  unfollowUser,
} from './follows.service.ts';

/** Подписки: все небезопасные методы требуют авторизации и CSRF. */
export const followsRouter = Router();

function findTarget(req: Request): UserRow {
  const target = findUserByUsername(pathParam(req, 'username'));
  if (target === null) throw new NotFoundError();
  return target;
}

followsRouter.post('/users/:username/follow', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const target = findTarget(req);
  followUser(target, viewer.user.id);
  res.status(200).json({ isFollowing: true });
});

followsRouter.delete('/users/:username/follow', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const target = findTarget(req);
  // Отписка разрешена и от закрытого профиля; на несуществующего — 404.
  unfollowUser(target.id, viewer.user.id);
  res.status(200).json({ isFollowing: false });
});

followsRouter.get('/me/followers', (_req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const users = listFollowers(viewer.user.id);
  res.status(200).json({ users, total: users.length });
});

followsRouter.get('/me/following', (_req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const users = listFollowing(viewer.user.id);
  res.status(200).json({ users, total: users.length });
});

followsRouter.delete('/me/followers/:userId', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  removeFollower(viewer.user.id, pathParam(req, 'userId'));
  res.status(204).end();
});

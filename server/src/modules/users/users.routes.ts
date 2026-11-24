import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppError, NotFoundError } from '../../errors.ts';
import { toUserPublicDTO, toUserSelfDTO } from '../../lib/dto.ts';
import { parseBody, pathParam } from '../../lib/http.ts';
import { getViewer, requireViewer } from '../../lib/session.ts';
import { removeStoredImage, saveResizedImage, uploadImage } from '../../lib/uploads.ts';
import { getProfileViewer, getUserFollowCounts } from '../follows/follows.service.ts';
import { listProfileWishlists } from '../wishlists/wishlists.service.ts';
import { profileUpdateSchema } from './users.schemas.ts';
import { findUserByUsername, setUserAvatar, updateUserProfile } from './users.service.ts';

export const usersRouter = Router();

/** Проверка входа ДО разбора файла: гостю не нужно грузить мегабайты в память. */
function requireAuthBeforeUpload(_req: Request, res: Response, next: NextFunction): void {
  requireViewer(res);
  next();
}

usersRouter.post('/me/avatar', requireAuthBeforeUpload, uploadImage, async (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const file = req.file;
  if (file === undefined) {
    throw new AppError(400, 'INVALID_IMAGE', 'Прикрепите изображение в поле «file».');
  }

  const storedPath = await saveResizedImage(file.buffer, {
    folder: 'avatars',
    width: 256,
    height: 256,
  });
  const oldPath = viewer.user.avatar_path;
  const user = setUserAvatar(viewer.user.id, storedPath);
  removeStoredImage(oldPath);

  res.status(200).json({ user: toUserSelfDTO(user, getUserFollowCounts(user.id)) });
});

usersRouter.patch('/me/profile', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, profileUpdateSchema);
  const user = updateUserProfile(viewer.user, body);
  // Счётчики подписок видит только владелец — добавляем в self-DTO.
  res.status(200).json({ user: toUserSelfDTO(user, getUserFollowCounts(user.id)) });
});

usersRouter.get('/users/:username', (req: Request, res: Response) => {
  const viewer = getViewer(res);
  const profile = findUserByUsername(pathParam(req, 'username'));
  if (profile === null) throw new NotFoundError();

  const profileViewer = getProfileViewer(profile, viewer?.user.id ?? null);
  // Закрытый профиль виден только владельцу; остальным — 404, не 403.
  if (!profileViewer.isSelf && profile.is_profile_public !== 1) throw new NotFoundError();

  res.status(200).json({
    user: toUserPublicDTO(profile),
    wishlists: listProfileWishlists(profile.id, {
      isOwner: profileViewer.isSelf,
      isFollower: profileViewer.isFollowing,
    }),
    viewer: profileViewer,
  });
});

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireViewer } from '../../lib/session.ts';
import { getFeed } from './feed.service.ts';

export const feedRouter = Router();

/** Лента доступна только авторизованным. */
feedRouter.get('/me/feed', (_req: Request, res: Response) => {
  const viewer = requireViewer(res);
  res.status(200).json({ items: getFeed(viewer.user.id) });
});

import { Router } from 'express';
import { attachViewer, csrfProtection } from './lib/session.ts';
import { authRouter } from './modules/auth/auth.routes.ts';
import { categoriesRouter } from './modules/categories/categories.routes.ts';
import { feedRouter } from './modules/feed/feed.routes.ts';
import { followsRouter } from './modules/follows/follows.routes.ts';
import { giftsRouter } from './modules/gifts/gifts.routes.ts';
import { publicRouter } from './modules/public/public.routes.ts';
import { usersRouter } from './modules/users/users.routes.ts';
import { wishlistsRouter } from './modules/wishlists/wishlists.routes.ts';

/**
 * Сборка API этапа 2. Порядок middleware важен: сначала определяем смотрящего
 * (cookie `sid`), затем проверяем CSRF для авторизованных небезопасных методов.
 */
export const apiRouter = Router();

apiRouter.use(attachViewer);
apiRouter.use(csrfProtection);
apiRouter.use(authRouter);
apiRouter.use(usersRouter);
apiRouter.use(followsRouter);
apiRouter.use(feedRouter);
apiRouter.use(wishlistsRouter);
apiRouter.use(categoriesRouter);
apiRouter.use(giftsRouter);
apiRouter.use(publicRouter);

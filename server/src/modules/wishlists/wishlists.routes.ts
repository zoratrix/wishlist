import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors.ts';
import { toWishlistSummaryDTO } from '../../lib/dto.ts';
import { parseBody, pathParam } from '../../lib/http.ts';
import type { WishlistRow } from '../../lib/rows.ts';
import { requireViewer } from '../../lib/session.ts';
import { removeStoredImage, saveResizedImage, uploadImage } from '../../lib/uploads.ts';
import { listWishlistCategories } from '../categories/categories.service.ts';
import { listGiftRows, toOwnerGiftDTOs } from '../gifts/gifts.service.ts';
import {
  clearWishlistCover,
  countGifts,
  createWishlist,
  deleteWishlist,
  getOwnerWishlist,
  listOwnerWishlists,
  regenerateShareToken,
  reorderWishlists,
  setWishlistCover,
  updateWishlist,
} from './wishlists.service.ts';
import {
  createWishlistSchema,
  reorderWishlistsSchema,
  updateWishlistSchema,
} from './wishlists.schemas.ts';

export const wishlistsRouter = Router();

/** Проверка владельца до разбора файла: чужой вишлист → 404 без загрузки. */
function loadOwnedWishlist(req: Request, res: Response, next: NextFunction): void {
  const viewer = requireViewer(res);
  res.locals.wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  next();
}

wishlistsRouter.get('/me/wishlists', (_req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const wishlists = listOwnerWishlists(viewer.user.id).map((row) =>
    toWishlistSummaryDTO(row, row.gift_count),
  );
  res.status(200).json({ wishlists });
});

wishlistsRouter.post('/me/wishlists', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, createWishlistSchema);
  const wishlist = createWishlist(viewer.user.id, body);
  res.status(201).json({ wishlist: toWishlistSummaryDTO(wishlist, 0) });
});

wishlistsRouter.post('/me/wishlists/reorder', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, reorderWishlistsSchema);
  reorderWishlists(viewer.user.id, body.order);
  res.status(204).end();
});

/** Перевыпуск короткой ссылки (старая перестаёт работать). */
wishlistsRouter.post('/me/wishlists/:id/share-token', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  const updated = regenerateShareToken(wishlist);
  res.status(200).json({
    wishlist: toWishlistSummaryDTO(updated, countGifts(updated.id)),
  });
});

wishlistsRouter.get('/me/wishlists/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  const gifts = toOwnerGiftDTOs(wishlist, listGiftRows(wishlist.id));
  res.status(200).json({
    wishlist: toWishlistSummaryDTO(wishlist, gifts.length),
    gifts,
    categories: listWishlistCategories(wishlist.id),
  });
});

wishlistsRouter.patch('/me/wishlists/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, updateWishlistSchema);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  const updated = updateWishlist(wishlist, body);
  res.status(200).json({ wishlist: toWishlistSummaryDTO(updated, countGifts(updated.id)) });
});

wishlistsRouter.post('/me/wishlists/:id/cover', loadOwnedWishlist, uploadImage, async (req: Request, res: Response) => {
  const wishlist = res.locals.wishlist as WishlistRow;
  const file = req.file;
  if (file === undefined) {
    throw new AppError(400, 'INVALID_IMAGE', 'Прикрепите изображение в поле «file».');
  }

  const storedPath = await saveResizedImage(file.buffer, {
    folder: 'covers',
    width: 1600,
    height: 600,
  });
  const oldPath = wishlist.cover_path;
  const updated = setWishlistCover(wishlist, storedPath);
  removeStoredImage(oldPath);

  res.status(200).json({ wishlist: toWishlistSummaryDTO(updated, countGifts(updated.id)) });
});

wishlistsRouter.delete('/me/wishlists/:id/cover', loadOwnedWishlist, (req: Request, res: Response) => {
  const wishlist = res.locals.wishlist as WishlistRow;
  const updated = clearWishlistCover(wishlist);
  removeStoredImage(wishlist.cover_path);
  res.status(200).json({ wishlist: toWishlistSummaryDTO(updated, countGifts(updated.id)) });
});

wishlistsRouter.delete('/me/wishlists/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  removeStoredImage(wishlist.cover_path);
  deleteWishlist(wishlist);
  res.status(204).end();
});

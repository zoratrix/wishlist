import { Router } from 'express';
import type { Request, Response } from 'express';
import { parseBody, pathParam } from '../../lib/http.ts';
import { requireViewer } from '../../lib/session.ts';
import { getOwnerWishlist } from '../wishlists/wishlists.service.ts';
import {
  createGift,
  deleteGift,
  getOwnedGift,
  moveGift,
  reorderGifts,
  setGiftStatus,
  toOwnerGiftDTO,
  updateGift,
} from './gifts.service.ts';
import {
  createGiftSchema,
  giftStatusSchema,
  moveGiftSchema,
  reorderGiftsSchema,
  updateGiftSchema,
} from './gifts.schemas.ts';

export const giftsRouter = Router();

giftsRouter.post('/me/wishlists/:id/gifts', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, createGiftSchema);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  const gift = createGift(wishlist, body);
  res.status(201).json({ gift: toOwnerGiftDTO(gift, wishlist) });
});

giftsRouter.post('/me/wishlists/:id/gifts/reorder', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, reorderGiftsSchema);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  reorderGifts(wishlist, body.order);
  res.status(204).end();
});

giftsRouter.patch('/me/gifts/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, updateGiftSchema);
  const { gift, wishlist } = getOwnedGift(pathParam(req, 'id'), viewer.user.id);
  const updated = updateGift(gift, body);
  res.status(200).json({ gift: toOwnerGiftDTO(updated, wishlist) });
});

giftsRouter.delete('/me/gifts/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const { gift } = getOwnedGift(pathParam(req, 'id'), viewer.user.id);
  deleteGift(gift);
  res.status(204).end();
});

giftsRouter.post('/me/gifts/:id/status', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, giftStatusSchema);
  const { gift, wishlist } = getOwnedGift(pathParam(req, 'id'), viewer.user.id);
  const updated = setGiftStatus(gift, body.status);
  res.status(200).json({ gift: toOwnerGiftDTO(updated, wishlist) });
});

giftsRouter.post('/me/gifts/:id/move', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, moveGiftSchema);
  const { gift } = getOwnedGift(pathParam(req, 'id'), viewer.user.id);
  const target = getOwnerWishlist(body.wishlistId, viewer.user.id);
  const moved = moveGift(gift, target);
  res.status(200).json({ gift: toOwnerGiftDTO(moved, target) });
});

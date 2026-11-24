import { Router } from 'express';
import type { Request, Response } from 'express';
import { NotFoundError } from '../../errors.ts';
import { toWishlistPublicDTO } from '../../lib/dto.ts';
import { clientIp, clientIpHash, parseBody, pathParam } from '../../lib/http.ts';
import { enforceRateLimit } from '../../lib/rate-limit.ts';
import type { GiftWithBookingRow, WishlistRow } from '../../lib/rows.ts';
import { findUserById, getViewer } from '../../lib/session.ts';
import { bookGift, unbookGift } from '../bookings/bookings.service.ts';
import { bookSchema, unbookSchema } from '../bookings/bookings.schemas.ts';
import { listWishlistCategories } from '../categories/categories.service.ts';
import { findGiftInWishlist, listGiftRows, toGuestGiftDTOs } from '../gifts/gifts.service.ts';
import { canViewWishlist, findWishlistByShareToken } from '../wishlists/wishlists.service.ts';

const BOOK_LIMIT = 30;
const BOOK_WINDOW_MS = 60 * 60 * 1000;

export const publicRouter = Router();

const NOT_FOUND_MESSAGE = 'Страница не найдена или недоступна.';

function loadWishlist(req: Request, res: Response): WishlistRow {
  const wishlist = findWishlistByShareToken(pathParam(req, 'shareToken'));
  const viewerId = getViewer(res)?.user.id ?? null;
  // Несуществующий/недоступный токен неотличимы — 404 без пояснений.
  if (wishlist === null || !canViewWishlist(wishlist, viewerId)) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }
  return wishlist;
}

function loadGift(req: Request, wishlist: WishlistRow): GiftWithBookingRow {
  const gift = findGiftInWishlist(pathParam(req, 'giftId'), wishlist.id);
  if (gift === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  return gift;
}

/** Гостевая страница вишлиста: имена/email бронирующих не раскрываются. */
publicRouter.get('/w/:shareToken', (req: Request, res: Response) => {
  const wishlist = loadWishlist(req, res);
  const owner = findUserById(wishlist.owner_id);
  if (owner === null) throw new NotFoundError(NOT_FOUND_MESSAGE);
  res.status(200).json({
    wishlist: toWishlistPublicDTO(wishlist, owner),
    gifts: toGuestGiftDTOs(listGiftRows(wishlist.id)),
    categories: listWishlistCategories(wishlist.id),
  });
});

publicRouter.post('/w/:shareToken/gifts/:giftId/book', (req: Request, res: Response) => {
  const wishlist = loadWishlist(req, res);
  const gift = loadGift(req, wishlist);
  const body = parseBody(req, bookSchema);
  enforceRateLimit(`book:${clientIp(req)}`, BOOK_LIMIT, BOOK_WINDOW_MS);

  const booking = bookGift(gift, body, clientIpHash(req));
  // Email бронирующего в ответе не возвращается — только время брони.
  res.status(201).json({ booking });
});

publicRouter.post('/w/:shareToken/gifts/:giftId/unbook', (req: Request, res: Response) => {
  const wishlist = loadWishlist(req, res);
  const gift = loadGift(req, wishlist);
  const body = parseBody(req, unbookSchema);
  unbookGift(gift, body.email, clientIpHash(req));
  res.status(200).json({ ok: true });
});

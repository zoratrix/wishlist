import { Router } from 'express';
import type { Request, Response } from 'express';
import { ValidationError } from '../../errors.ts';
import { toCategoryDTO } from '../../lib/dto.ts';
import { parseBody, pathParam } from '../../lib/http.ts';
import { requireViewer } from '../../lib/session.ts';
import { getOwnerWishlist } from '../wishlists/wishlists.service.ts';
import { categoryCreateSchema, categoryUpdateSchema } from './categories.schemas.ts';
import {
  createCategory,
  deleteCategory,
  getOwnedCategory,
  normalizeCategoryColor,
  updateCategory,
} from './categories.service.ts';

/** Категории (теги) — только владелец вишлиста; чужие объекты → 404. */
export const categoriesRouter = Router();

categoriesRouter.post('/me/wishlists/:id/categories', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, categoryCreateSchema);
  const wishlist = getOwnerWishlist(pathParam(req, 'id'), viewer.user.id);
  // Отсутствующий color и null одинаково означают «цвет по умолчанию».
  const color = normalizeCategoryColor(body.color) ?? null;
  const category = createCategory(wishlist, body.name, color);
  res.status(201).json({ category: toCategoryDTO(category) });
});

categoriesRouter.patch('/me/categories/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const body = parseBody(req, categoryUpdateSchema);
  if (body.name === undefined && body.color === undefined) {
    throw new ValidationError([
      { path: 'name', message: 'Укажите, что изменить: название или цвет категории.' },
    ]);
  }
  const category = getOwnedCategory(pathParam(req, 'id'), viewer.user.id);
  const color = normalizeCategoryColor(body.color);
  const updated = updateCategory(category, { name: body.name, color });
  res.status(200).json({ category: toCategoryDTO(updated) });
});

categoriesRouter.delete('/me/categories/:id', (req: Request, res: Response) => {
  const viewer = requireViewer(res);
  const category = getOwnedCategory(pathParam(req, 'id'), viewer.user.id);
  deleteCategory(category);
  res.status(204).end();
});

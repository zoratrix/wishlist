import { z } from 'zod';
import {
  currencySchema,
  giftLinksSchema,
  giftTitleSchema,
  idSchema,
  longTextSchema,
  orderSchema,
  priceMinorSchema,
  prioritySchema,
} from '../../lib/schemas.ts';

/** Теги подарка: 0–5, уникальные id; принадлежность вишлисту проверяет сервис. */
const categoryIdsSchema = z
  .array(idSchema)
  .max(5, 'У подарка может быть не больше 5 категорий.')
  .refine((ids) => new Set(ids).size === ids.length, 'Категории не должны повторяться.');

export const createGiftSchema = z.object({
  title: giftTitleSchema,
  description: longTextSchema.optional(),
  links: giftLinksSchema.optional(),
  categoryIds: categoryIdsSchema.optional(),
  priceMinor: priceMinorSchema.nullable().optional(),
  currency: currencySchema.optional(),
  priority: prioritySchema.optional(),
});

export const updateGiftSchema = z.object({
  title: giftTitleSchema.optional(),
  description: longTextSchema.optional(),
  // При PATCH поле заменяет весь список; отсутствие поля — список не меняется.
  links: giftLinksSchema.optional(),
  categoryIds: categoryIdsSchema.optional(),
  priceMinor: priceMinorSchema.nullable().optional(),
  currency: currencySchema.optional(),
  priority: prioritySchema.optional(),
});

export const reorderGiftsSchema = z.object({ order: orderSchema });

export const giftStatusSchema = z.object({
  status: z.enum(['available', 'gifted']),
});

export const moveGiftSchema = z.object({ wishlistId: idSchema });

export type CreateGiftInput = z.infer<typeof createGiftSchema>;
export type UpdateGiftInput = z.infer<typeof updateGiftSchema>;
export type GiftStatusInput = z.infer<typeof giftStatusSchema>['status'];

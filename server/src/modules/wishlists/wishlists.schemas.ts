import { z } from 'zod';
import {
  eventDateSchema,
  longTextSchema,
  orderSchema,
  titleSchema,
  visibilitySchema,
} from '../../lib/schemas.ts';

export const createWishlistSchema = z.object({
  title: titleSchema,
  description: longTextSchema.optional(),
  eventDate: eventDateSchema.nullable().optional(),
  visibility: visibilitySchema.optional(),
  // color проверяет сервис по палитре: невалидный → 400 INVALID_COLOR.
  themeColor: z.unknown().optional(),
  // эмодзи проверяет сервис: невалидный → 400 INVALID_EMOJI.
  themeEmoji: z.unknown().optional(),
});

export const updateWishlistSchema = z.object({
  title: titleSchema.optional(),
  description: longTextSchema.optional(),
  eventDate: eventDateSchema.nullable().optional(),
  visibility: visibilitySchema.optional(),
  themeColor: z.unknown().optional(),
  themeEmoji: z.unknown().optional(),
  showBooked: z.boolean().optional(),
  showBookerNames: z.boolean().optional(),
});

export const reorderWishlistsSchema = z.object({ order: orderSchema });

export type CreateWishlistInput = z.infer<typeof createWishlistSchema>;
export type UpdateWishlistInput = z.infer<typeof updateWishlistSchema>;

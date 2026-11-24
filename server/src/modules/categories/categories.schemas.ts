import { z } from 'zod';

/** Название категории: 1–40 символов, крайние пробелы обрезаются. */
export const categoryNameSchema = z
  .string({ error: 'Введите название категории.' })
  .trim()
  .min(1, 'Название категории не может быть пустым.')
  .max(40, 'Название категории должно быть не длиннее 40 символов.');

/**
 * Цвет принимаем как unknown: значение проверяет сервис по палитре, чтобы
 * невалидный цвет давал отдельный код `INVALID_COLOR` (а не общий
 * `VALIDATION_ERROR`). Отсутствие поля и null одинаково означают «цвет по
 * умолчанию».
 */
const categoryColorInput = z.unknown().optional();

export const categoryCreateSchema = z.object({
  name: categoryNameSchema,
  color: categoryColorInput,
});

export const categoryUpdateSchema = z.object({
  name: categoryNameSchema.optional(),
  color: categoryColorInput,
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

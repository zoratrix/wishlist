/** Палитра цветов категорий (общая для пикера и чипов). Пастельная, чистая. */

import { mixHexWithWhite } from './color';

export const CATEGORY_COLORS = [
  '#E0776A',
  '#EE9B63',
  '#E8C466',
  '#7FC290',
  '#64BDB2',
  '#7FAFE2',
  '#A78FDE',
  '#E28FAF',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === 'string' && (CATEGORY_COLORS as readonly string[]).includes(value);
}

export interface CategoryTint {
  backgroundColor: string;
}

/**
 * Светлая непрозрачная подложка чипа. Текст остаётся тёмным — цвет
 * используется только как акцент, чтобы контраст текста не падал.
 * Полупрозрачный тинт здесь нельзя: сквозь него просвечивает фон страницы.
 */
export function categoryTint(color: string | null | undefined): CategoryTint | undefined {
  if (!color) {
    return undefined;
  }
  return { backgroundColor: mixHexWithWhite(color, 0.16) };
}

export function categoryDotStyle(
  color: string | null | undefined,
): { backgroundColor: string } | undefined {
  return color ? { backgroundColor: color } : undefined;
}

/** Цвет для aria/подписи: hex как есть. */
export function categoryColorLabel(color: string | null): string {
  return color ?? 'по умолчанию';
}

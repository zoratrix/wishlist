/** Палитра цветов категорий (общая для пикера и чипов). */

export const CATEGORY_COLORS = [
  '#C4574D',
  '#C57A44',
  '#C0A24C',
  '#6E9B78',
  '#4F8C86',
  '#5A7BA6',
  '#8A7BB2',
  '#B36B88',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === 'string' && (CATEGORY_COLORS as readonly string[]).includes(value);
}

export interface CategoryTint {
  backgroundColor: string;
}

/**
 * Светлая подложка чипа + рамка выбранного цвета. Текст остаётся тёмным —
 * цвет используется только как акцент, чтобы контраст текста не падал.
 */
export function categoryTint(color: string | null | undefined): CategoryTint | undefined {
  if (!color) {
    return undefined;
  }
  return { backgroundColor: `${color}24` };
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

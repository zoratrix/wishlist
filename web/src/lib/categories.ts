import type { CategoryDTO, GiftDTO } from './types';

export const MAX_GIFT_CATEGORIES = 5;
export const CATEGORY_NAME_MAX = 40;

/** «Все», «Без категории» или id конкретной категории. */
export type CategoryFilter = 'all' | 'none' | string;

export function filterGifts(gifts: GiftDTO[], filter: CategoryFilter): GiftDTO[] {
  if (filter === 'all') {
    return gifts;
  }
  if (filter === 'none') {
    return gifts.filter((gift) => (gift.categories ?? []).length === 0);
  }
  return gifts.filter((gift) =>
    (gift.categories ?? []).some((category) => category.id === filter),
  );
}

export function giftCategoryIds(gift: GiftDTO): string[] {
  return (gift.categories ?? []).map((category) => category.id);
}

/** Если выбранная категория исчезла (удалена), показываем «Все». */
export function resolveCategoryFilter(
  filter: CategoryFilter,
  categories: CategoryDTO[],
): CategoryFilter {
  if (filter === 'all' || filter === 'none') {
    return filter;
  }
  return categories.some((category) => category.id === filter) ? filter : 'all';
}

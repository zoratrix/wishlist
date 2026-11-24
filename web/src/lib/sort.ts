import type { GiftDTO } from './types';

/** Варианты сортировки списка подарков. */
export type GiftSort =
  | 'order'
  | 'newest'
  | 'oldest'
  | 'title-asc'
  | 'title-desc'
  | 'price-asc'
  | 'price-desc'
  | 'priority'
  | 'category'
  | 'available-first'
  | 'booked-first';

export const SORT_KEY = 'wl:sort:v1';
export const DEFAULT_SORT: GiftSort = 'order';

export interface SortOption {
  value: GiftSort;
  label: string;
  /** Сортировка по занятости: у владельца при showBooked=false скрывается. */
  availability?: boolean;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'order', label: 'По порядку' },
  { value: 'newest', label: 'Сначала новые' },
  { value: 'oldest', label: 'Сначала старые' },
  { value: 'title-asc', label: 'По алфавиту А–Я' },
  { value: 'title-desc', label: 'По алфавиту Я–А' },
  { value: 'price-asc', label: 'По цене ↑' },
  { value: 'price-desc', label: 'По цене ↓' },
  { value: 'priority', label: 'По приоритету' },
  { value: 'category', label: 'По категориям' },
  { value: 'available-first', label: 'Сначала свободные', availability: true },
  { value: 'booked-first', label: 'Сначала занятые', availability: true },
];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((option) => option.value));

export function isGiftSort(value: unknown): value is GiftSort {
  return typeof value === 'string' && SORT_VALUES.has(value);
}

/** Сохранённый выбор; неизвестное/битое значение → «По порядку». */
export function readGiftSort(): GiftSort {
  try {
    const stored = window.localStorage.getItem(SORT_KEY);
    return isGiftSort(stored) ? stored : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

export function writeGiftSort(sort: GiftSort): void {
  try {
    window.localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Storage может быть запрещён — выбор просто не сохранится.
  }
}

export function isAvailabilitySort(sort: GiftSort): boolean {
  return sort === 'available-first' || sort === 'booked-first';
}

/** Свободен = не подарен и нет активной брони. */
function isAvailable(gift: GiftDTO): boolean {
  return gift.booking === null && gift.status === 'available';
}

const collator = new Intl.Collator('ru-RU', { sensitivity: 'base' });

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareCategory(a: GiftDTO, b: GiftDTO): number {
  const aCategory = a.categories?.[0]?.name ?? null;
  const bCategory = b.categories?.[0]?.name ?? null;
  if (aCategory === null && bCategory === null) return 0;
  if (aCategory === null) return 1;
  if (bCategory === null) return -1;
  return collator.compare(aCategory, bCategory);
}

function comparePriceDesc(a: GiftDTO, b: GiftDTO): number {
  const aPrice = a.priceMinor;
  const bPrice = b.priceMinor;
  if (aPrice === null && bPrice === null) return 0;
  // Без цены — в конце и при убывании.
  if (aPrice === null) return 1;
  if (bPrice === null) return -1;
  return bPrice - aPrice;
}

function comparator(sort: GiftSort): (a: GiftDTO, b: GiftDTO) => number {
  switch (sort) {
    case 'newest':
      return (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt);
    case 'oldest':
      return (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
    case 'title-asc':
      return (a, b) => collator.compare(a.title, b.title);
    case 'title-desc':
      return (a, b) => collator.compare(b.title, a.title);
    case 'price-asc':
      return (a, b) => compareNullableNumber(a.priceMinor, b.priceMinor);
    case 'price-desc':
      return comparePriceDesc;
    case 'priority':
      return (a, b) => a.priority - b.priority;
    case 'category':
      return (a, b) => compareCategory(a, b) || collator.compare(a.title, b.title);
    case 'available-first':
      return (a, b) => Number(!isAvailable(a)) - Number(!isAvailable(b));
    case 'booked-first':
      return (a, b) => Number(isAvailable(a)) - Number(isAvailable(b));
    case 'order':
    default:
      return () => 0;
  }
}

/**
 * Сортировка после фильтра. Стабильность: при равенстве сохраняется исходный
 * ручной порядок (вторичный ключ — текущий индекс, то есть sortOrder с сервера).
 */
export function sortGifts(gifts: GiftDTO[], sort: GiftSort): GiftDTO[] {
  if (sort === 'order' || gifts.length < 2) {
    return gifts;
  }
  const compare = comparator(sort);
  return gifts
    .map((gift, index) => ({ gift, index }))
    .sort((a, b) => compare(a.gift, b.gift) || a.index - b.index)
    .map((item) => item.gift);
}

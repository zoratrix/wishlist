import type { Visibility } from './types';

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Цена в копейках → «1 500 ₽». null → пустая строка. */
export function formatPrice(priceMinor: number | null): string {
  if (priceMinor === null || !Number.isFinite(priceMinor)) {
    return '';
  }
  return `${rubFormatter.format(priceMinor / 100)} ₽`;
}

/** Копейки → значение для поля ввода в рублях (без хвостовых нулей). */
export function priceMinorToInput(priceMinor: number | null): string {
  if (priceMinor === null) {
    return '';
  }
  const rubles = priceMinor / 100;
  return Number.isInteger(rubles) ? String(rubles) : rubles.toFixed(2);
}

/** «1 500,50» / «1500» → копейки. Пустая строка → null (очистить поле). */
export function parsePriceMinor(input: string): number | null {
  const normalized = input.trim().replace(/\s+/g, '').replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Цена должна быть положительным числом.');
  }
  return Math.round(value * 100);
}

/** Дата события «YYYY-MM-DD» → «20 декабря 2026 г.». Невалидная — как есть. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return value;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) {
    return value;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateFormatter.format(date);
}

/** «5 подарков», «1 подарок», «2 подарка». */
export function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}

export function giftsCountLabel(count: number): string {
  return `${count} ${pluralRu(count, 'подарок', 'подарка', 'подарков')}`;
}

export function visibilityLabel(visibility: Visibility): string {
  if (visibility === 'public') return 'Публичный';
  if (visibility === 'link') return 'По ссылке';
  return 'Только подписчикам';
}

export function visibilityHint(visibility: Visibility): string {
  if (visibility === 'public') {
    return 'Виден всем в публичном профиле и по ссылке.';
  }
  if (visibility === 'link') {
    return 'Доступен только тем, кому вы отправили ссылку.';
  }
  return 'Доступен только подписчикам. Прямая ссылка не даёт доступа, гостям список недоступен.';
}

const birthdayFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

/** «15 апреля» (+ « 1992 г.», если год показывается). */
export function formatBirthday(
  month: number | null,
  day: number | null,
  year?: number | null,
  showYear?: boolean,
): string {
  if (!month || !day) {
    return '';
  }
  const date = new Date(2000, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const base = birthdayFormatter.format(date);
  if (showYear && year) {
    return `${base} ${year} г.`;
  }
  return base;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export function monthOptions(): { value: number; label: string }[] {
  return MONTH_NAMES.map((label, index) => ({ value: index + 1, label }));
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Дни для выбранного месяца (без года — берём максимум, февраль 29). */
export function dayOptions(month: number | null): number[] {
  const limit = month && month >= 1 && month <= 12 ? (DAYS_IN_MONTH[month - 1] ?? 31) : 31;
  return Array.from({ length: limit }, (_value, index) => index + 1);
}

export interface PriorityMeta {
  value: number;
  label: string;
  dot: string;
}

const PRIORITY_FALLBACK: PriorityMeta = {
  value: 3,
  label: 'Обычный приоритет',
  dot: 'bg-muted',
};

const PRIORITIES: PriorityMeta[] = [
  { value: 1, label: 'Очень важно', dot: 'bg-accent' },
  { value: 2, label: 'Важно', dot: 'bg-accent/70' },
  { value: 3, label: 'Обычный приоритет', dot: 'bg-muted' },
  { value: 4, label: 'Не очень важно', dot: 'bg-line' },
  { value: 5, label: 'Неважно', dot: 'bg-line' },
];

export function priorityMeta(value: number): PriorityMeta {
  return PRIORITIES.find((item) => item.value === value) ?? PRIORITY_FALLBACK;
}

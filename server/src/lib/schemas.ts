import { z } from 'zod';

/** Идентификатор объекта — строка (UUID). Пустой запрещён. */
export const idSchema = z.string({ error: 'Не указан идентификатор.' }).min(1, 'Не указан идентификатор.');

export const titleSchema = z
  .string({ error: 'Введите название.' })
  .trim()
  .min(1, 'Название не может быть пустым.')
  .max(100, 'Название должно быть не длиннее 100 символов.');

export const giftTitleSchema = z
  .string({ error: 'Введите название подарка.' })
  .trim()
  .min(1, 'Название подарка не может быть пустым.')
  .max(200, 'Название подарка должно быть не длиннее 200 символов.');

export const longTextSchema = z
  .string()
  .max(2000, 'Текст должен быть не длиннее 2000 символов.')
  .nullable();

/** Дата без времени: YYYY-MM-DD, проверяется существование дня в месяце. */
export const eventDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате ГГГГ-ММ-ДД.')
  .refine(isRealDate, 'Такой даты не существует.');

function isRealDate(value: string): boolean {
  const parts = value.split('-').map((part) => Number(part));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Ссылка на товар: только http/https. */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(2000, 'Ссылка должна быть не длиннее 2000 символов.')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Ссылка должна начинаться с http:// или https://.');

/**
 * Ссылки на товар: 0–10 штук, порядок сохраняется, дубликаты удаляются
 * в сервисе. Больше 10 — ошибка валидации (не «обрезаем молча»).
 */
export const giftLinksSchema = z
  .array(httpUrlSchema)
  .max(10, 'У подарка может быть не больше 10 ссылок.');

export const priceMinorSchema = z
  .number({ error: 'Цена должна быть числом.' })
  .int('Цена должна быть целым числом копеек.')
  .min(0, 'Цена не может быть отрицательной.');

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Валюта — три латинские буквы (например, RUB).');

export const prioritySchema = z
  .number({ error: 'Приоритет должен быть числом.' })
  .int('Приоритет должен быть целым числом.')
  .min(1, 'Приоритет — от 1 до 5.')
  .max(5, 'Приоритет — от 1 до 5.');

export const visibilitySchema = z.enum(['public', 'link', 'followers'], {
  error: 'Видимость: «публичный», «по ссылке» или «только подписчикам».',
});

/**
 * Палитра цветов категорий — единственные допустимые значения `color`.
 * Проверяется в сервисе, чтобы отдавать отдельный код `INVALID_COLOR`
 * (а не общий `VALIDATION_ERROR`); в БД CHECK нет, чтобы список можно было
 * расширять без миграции схемы.
 */
export const CATEGORY_COLOR_PALETTE = [
  '#E0776A',
  '#EE9B63',
  '#E8C466',
  '#7FC290',
  '#64BDB2',
  '#7FAFE2',
  '#A78FDE',
  '#E28FAF',
] as const;

export type CategoryColor = (typeof CATEGORY_COLOR_PALETTE)[number];

const CATEGORY_COLOR_SET: ReadonlySet<string> = new Set(CATEGORY_COLOR_PALETTE);

export function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === 'string' && CATEGORY_COLOR_SET.has(value);
}

/** Ограничение длины эмодзи-оформления — в UTF-16 символах. */
export const THEME_EMOJI_MAX_LENGTH = 8;

const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
/** ASCII-буквы, цифры и любые пробельные символы в эмодзи не допускаются. */
const FORBIDDEN_EMOJI_CHARS = /[A-Za-z0-9\s]/;

/**
 * Допустимое эмодзи-оформление вишлиста: после trim 1–8 UTF-16 символов,
 * минимум один эмодзи (Extended_Pictographic), без ASCII-букв, цифр и
 * пробелов. Палитра не ограничена — подходит любой эмодзи; отдельная
 * проверка нужна сервису, чтобы вернуть код INVALID_EMOJI.
 */
export function isThemeEmoji(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > THEME_EMOJI_MAX_LENGTH) return false;
  return EXTENDED_PICTOGRAPHIC.test(trimmed) && !FORBIDDEN_EMOJI_CHARS.test(trimmed);
}

/** Порядок объектов: массив идентификаторов. */
export const orderSchema = z
  .array(idSchema)
  .min(1, 'Список порядка не может быть пустым.')
  .max(1000, 'Слишком много элементов в списке порядка.');

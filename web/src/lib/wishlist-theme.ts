/** Приглушённая палитра тем оформления вишлиста (этап 4a) и эмодзи-фон (4b). */

import type { CSSProperties } from 'react';

export const WISHLIST_THEME_COLORS = [
  '#C4574D',
  '#C57A44',
  '#C0A24C',
  '#6E9B78',
  '#4F8C86',
  '#5A7BA6',
  '#8A7BB2',
  '#B36B88',
] as const;

export type WishlistThemeColor = (typeof WISHLIST_THEME_COLORS)[number];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Тема может быть любым цветом #RRGGBB (пресеты — просто быстрый выбор). */
export function isWishlistThemeColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Нормализация цвета темы: валидный hex → верхний регистр, иначе null. */
export function normalizeThemeColor(value: unknown): string | null {
  return isWishlistThemeColor(value) ? value.toUpperCase() : null;
}

/** Предлагаемые эмодзи для фона страницы вишлиста. */
export const WISHLIST_EMOJI_PRESETS = [
  '🎁',
  '🎂',
  '❤️',
  '🌲',
  '🏠',
  '📚',
  '✈️',
  '🎮',
  '🌸',
  '🍰',
] as const;

/** Ограничение длины эмодзи-оформления — в UTF-16 символах (как на сервере). */
export const THEME_EMOJI_MAX_LENGTH = 8;

const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
/** ASCII-буквы, цифры и любые пробельные символы в эмодзи не допускаются. */
const FORBIDDEN_EMOJI_CHARS = /[A-Za-z0-9\s]/;

export function isWishlistEmojiPreset(value: string): boolean {
  return (WISHLIST_EMOJI_PRESETS as readonly string[]).includes(value);
}

/**
 * Допустимое эмодзи-оформление: после trim 1–8 UTF-16 символов, минимум один
 * эмодзи (Extended_Pictographic), без ASCII-букв, цифр и пробелов.
 * Проверка повторяет серверную (`server/src/lib/schemas.ts`).
 */
export function isThemeEmoji(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > THEME_EMOJI_MAX_LENGTH) {
    return false;
  }
  return EXTENDED_PICTOGRAPHIC.test(trimmed) && !FORBIDDEN_EMOJI_CHARS.test(trimmed);
}

/** null/пустая строка → «без эмодзи»; иначе trim (валидация — отдельно). */
export function normalizeThemeEmoji(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Рамка/полоса шапки цветом темы; по умолчанию — undefined. */
export function themeBorderStyle(
  color: string | null | undefined,
): { borderColor: string } | undefined {
  return color ? { borderColor: color } : undefined;
}

export function themeStripStyle(
  color: string | null | undefined,
): { backgroundColor: string } | undefined {
  return color ? { backgroundColor: color } : undefined;
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!match) {
    return null;
  }
  const hex = match[1];
  if (!hex) {
    return null;
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

/** #RRGGBB → rgba(..., alpha); null, если цвет не hex-формата. */
export function themeTint(color: string | null | undefined, alpha: number): string | null {
  if (!color) {
    return null;
  }
  const rgb = parseHexColor(color);
  if (!rgb) {
    return null;
  }
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Затемнённый вариант цвета темы для фона кнопок и активных ссылок.
 * Тема может быть любым цветом, поэтому затемняем до тех пор, пока белый
 * текст на нём не станет читаемым (contrast ≥ 4.5).
 */
export function darkenThemeColor(color: string, factor = 0.78): string {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return color;
  }
  const current: [number, number, number] = [rgb[0], rgb[1], rgb[2]];
  let guard = 0;
  while (relativeLuminance(current) > 0.42 && guard < 8) {
    current[0] = Math.max(0, Math.min(255, Math.round(current[0] * factor)));
    current[1] = Math.max(0, Math.min(255, Math.round(current[1] * factor)));
    current[2] = Math.max(0, Math.min(255, Math.round(current[2] * factor)));
    guard += 1;
  }
  const channel = (value: number) => value.toString(16).padStart(2, '0');
  return `#${channel(current[0])}${channel(current[1])}${channel(current[2])}`;
}

/** Светлый оттенок темы для шапки/баннера списка. */
export function themeHeroTint(color: string | null | undefined): string | undefined {
  return themeTint(color, 0.2) ?? undefined;
}

/**
 * CSS-переменные темы на обёртке страницы вишлиста: акцент, оттенки, фон и
 * рамки. Заодно подменяются дизайн-токены Tailwind внутри обёртки — поэтому
 * кнопки, ссылки, бейджи и рамки карточек автоматически получают цвет темы,
 * а остальные страницы сайта остаются нейтральными.
 */
export type WishlistThemeStyle = CSSProperties & Record<`--${string}`, string>;

const TINT_ALPHA = 0.14;
const TINT_STRONG_ALPHA = 0.2;
const BORDER_ALPHA = 0.42;
const PAGE_ALPHA = 0.11;

export function wishlistThemeStyle(
  themeColor: string | null | undefined,
): WishlistThemeStyle | undefined {
  if (!themeColor) {
    return undefined;
  }
  const accentStrong = darkenThemeColor(themeColor);
  const tint = themeTint(themeColor, TINT_ALPHA);
  const tintStrong = themeTint(themeColor, TINT_STRONG_ALPHA);
  const border = themeTint(themeColor, BORDER_ALPHA);
  const page = themeTint(themeColor, PAGE_ALPHA);
  if (!tint || !tintStrong || !border || !page) {
    return undefined;
  }
  return {
    '--wl-accent': themeColor,
    '--wl-accent-strong': accentStrong,
    '--wl-tint': tint,
    '--wl-tint-strong': tintStrong,
    '--wl-border': border,
    '--wl-page-bg': page,
    '--color-accent': accentStrong,
    '--color-accent-soft': tint,
    '--color-line': border,
  };
}

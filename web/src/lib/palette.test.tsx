import { describe, expect, it } from 'vitest';
import { CATEGORY_COLORS, categoryTint } from './category-colors';
import { mixHexWithWhite } from './color';
import { WISHLIST_THEME_COLORS, wishlistThemeStyle } from './wishlist-theme';

describe('пастельные подложки и палитры', () => {
  it('mixHexWithWhite даёт непрозрачный пастельный hex', () => {
    expect(mixHexWithWhite('#E0776A', 0.16)).toBe('#FAE9E7');
    // Тинт не должен быть rgba/8-значным hex — иначе фон просвечивает.
    expect(mixHexWithWhite('#E0776A', 0.16)).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('подложка чипа категории непрозрачная, текст остаётся на светлом', () => {
    const tint = categoryTint('#E0776A');
    expect(tint?.backgroundColor).toMatch(/^#[0-9A-F]{6}$/);
    // Пастель светлая: все каналы заметно светлее исходного цвета.
    const channel = (hex: string, offset: number) =>
      Number.parseInt(hex.slice(offset, offset + 2), 16);
    expect(channel(tint!.backgroundColor, 1)).toBeGreaterThan(230);
    expect(channel(tint!.backgroundColor, 3)).toBeGreaterThan(200);
    expect(channel(tint!.backgroundColor, 5)).toBeGreaterThan(200);
  });

  it('в теме вишлиста «жёлтые» токены заменяются оттенком темы', () => {
    const style = wishlistThemeStyle('#E0776A');
    expect(style?.['--color-butter-soft']).toBe('#FAE9E7');
    expect(style?.['--color-accent-soft']).toBe('#FAE9E7');
    // Без темы ничего не подменяем — остаются привычные жёлтые подложки.
    expect(wishlistThemeStyle(null)).toBeUndefined();
  });

  it('палитры категорий и тем совпадают и содержат 8 чистых пастельных цветов', () => {
    expect([...CATEGORY_COLORS]).toEqual([...WISHLIST_THEME_COLORS]);
    expect(CATEGORY_COLORS).toHaveLength(8);
    expect(CATEGORY_COLORS[0]).toBe('#E0776A');
    expect(CATEGORY_COLORS[7]).toBe('#E28FAF');
  });
});

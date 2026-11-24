/** Работа с цветом: непрозрачные пастельные оттенки из hex-цвета. */

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

/**
 * Смешивает #RRGGBB с белым и возвращает непрозрачный hex.
 * `ratio` — доля цвета (0 — белый, 1 — исходный цвет).
 *
 * Нужен для подложек: полупрозрачный `#RRGGBB24` на фоне страницы с эмодзи
 * выглядит «грязно» и просвечивает, а непрозрачный пастельный оттенок
 * читается одинаково на любом фоне.
 */
export function mixHexWithWhite(color: string, ratio: number): string {
  const match = HEX_COLOR.exec(color);
  if (!match?.[1]) {
    return color;
  }
  const hex = match[1];
  const share = Math.min(1, Math.max(0, ratio));
  const channel = (offset: number): string => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16);
    const mixed = Math.round(255 - (255 - value) * share);
    return mixed.toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

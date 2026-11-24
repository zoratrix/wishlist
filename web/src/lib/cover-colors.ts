import { WISHLIST_THEME_COLORS } from './wishlist-theme';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Ближайший цвет темы к произвольному RGB (по сумме квадратов разницы). */
export function nearestThemeColor({ r, g, b }: Rgb): string {
  let best: string = WISHLIST_THEME_COLORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hex of WISHLIST_THEME_COLORS) {
    const candidate = parseHex(hex);
    const distance =
      (candidate.r - r) ** 2 + (candidate.g - g) ** 2 + (candidate.b - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hex;
    }
  }
  return best;
}

/** Доминирующий цвет картинки (без почти белых и почти чёрных пикселей). */
function dominantFromPixels(data: Uint8ClampedArray): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pixelR = data[i] ?? 0;
    const pixelG = data[i + 1] ?? 0;
    const pixelB = data[i + 2] ?? 0;
    const alpha = data[i + 3] ?? 255;
    if (alpha < 128) continue;
    const max = Math.max(pixelR, pixelG, pixelB);
    const min = Math.min(pixelR, pixelG, pixelB);
    if (max > 240 && min > 230) continue; // почти белый
    if (max < 25) continue; // почти чёрный
    r += pixelR;
    g += pixelG;
    b += pixelB;
    count += 1;
  }
  if (count === 0) return null;
  return toHex({ r: r / count, g: g / count, b: b / count });
}

export interface CoverThemeSuggestion {
  /** Доминирующий цвет обложки (он же предлагаемая тема). */
  dominant: string;
  /** Предлагаемый цвет темы — сам цвет обложки, без округления до палитры. */
  themeColor: string;
}

/**
 * Подбирает тему по обложке: средний цвет картинки → ближайший цвет палитры.
 * Возвращает null, если картинку не удалось прочитать (например, нет canvas).
 */
export async function suggestThemeFromImage(
  source: File | string,
): Promise<CoverThemeSuggestion | null> {
  let objectUrl: string | null = null;
  try {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    if (typeof source !== 'string') objectUrl = url;

    const image = await new Promise<HTMLImageElement | null>((resolve) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.onload = () => resolve(element);
      element.onerror = () => resolve(null);
      element.src = url;
    });
    if (!image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, 32, 32);
    const { data } = context.getImageData(0, 0, 32, 32);
    const dominant = dominantFromPixels(data);
    if (!dominant) return null;
    // Тема — сам цвет обложки (не ближайший из готовой палитры).
    return { dominant, themeColor: dominant };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

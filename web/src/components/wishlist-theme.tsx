import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  normalizeThemeEmoji,
  themeTint,
  wishlistThemeStyle,
  type WishlistThemeStyle,
} from '../lib/wishlist-theme';

const EMOJI_COLUMNS = 8;
const EMOJI_CELLS = 60;
const EMOJI_SEED = 20261123;

/** Короткий детерминированный хеш строки — сид для раскладки эмодзи. */
function hashSeed(value: string | null | undefined): number {
  const text = value && value.length > 0 ? value : 'default';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

interface EmojiSpot {
  left: number;
  top: number;
  size: number;
  rotate: number;
}

/** Детерминированно «разбрасывает» эмодзи: одинаковые позиции при перерисовках. */
function createEmojiLayout(seed: number): EmojiSpot[] {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return Array.from({ length: EMOJI_CELLS }, () => ({
    left: 2 + next() * 96,
    top: 2 + next() * 96,
    size: 40 + next() * 68,
    rotate: next() * 56 - 28,
  }));
}

/** Оттенок фона страницы: светлый, чтобы текст оставался тёмным и читаемым. */
const PAGE_BACKGROUND_ALPHA = 0.18;

export interface WishlistEmojiBackdropProps {
  emoji: string;
  seed?: string | null;
  className?: string;
}

/**
 * Декоративный слой: крупные эмодзи хаотично разбросаны по всему фону
 * страницы вишлиста. Полупрозрачный, размытый, за контентом — на чтение
 * и интерактивность не влияет.
 */
export function WishlistEmojiBackdrop({ emoji, seed, className }: WishlistEmojiBackdropProps) {
  // Раскладка зависит от сида вишлиста/версии настроек: у разных списков и после
  // каждого сохранения настроек эмодзи расположены по-разному.
  const layout = useMemo(() => createEmojiLayout(hashSeed(seed)), [seed]);

  return (
    <div
      data-wl-emoji-backdrop="true"
      aria-hidden="true"
      className={['fixed inset-0 overflow-hidden select-none', className ?? ''].join(' ').trim()}
      style={{
        zIndex: 1,
        opacity: 0.2,
        filter: 'blur(3.5px)',
        pointerEvents: 'none',
      }}
    >
      <div
        data-wl-emoji-grid="true"
        className="relative h-full w-full"
        style={{ gridTemplateColumns: `repeat(${EMOJI_COLUMNS}, minmax(0, 1fr))` }}
      >
        {layout.map((spot, index) => (
          <span
            key={index}
            data-wl-emoji-cell="true"
            className="absolute select-none"
            style={{
              left: `${spot.left}%`,
              top: `${spot.top}%`,
              fontSize: `${spot.size}px`,
              lineHeight: 1,
              transform: `translate(-50%, -50%) rotate(${spot.rotate}deg)`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface WishlistThemeProps {
  themeColor: string | null;
  themeEmoji?: string | null;
  /** Сид раскладки эмодзи (например, id + время обновления вишлиста). */
  seed?: string | null;
  children: ReactNode;
  className?: string;
}

/**
 * Обёртка страницы вишлиста: CSS-переменные темы, светлый фон на всю страницу
 * и (если задано) слой эмодзи. Оборачивает редактор и публичную страницу —
 * на остальные страницы сайта оформление не распространяется.
 *
 * Слои лежат ПОД контентом (z-index 0 и 1), контент — z-index 10. Это важно:
 * раньше фон и эмодзи были с отрицательным z-index и на практике оказывались
 * за непрозрачным фоном оболочки — оформление «не работало».
 */
export function WishlistTheme({
  themeColor,
  themeEmoji = null,
  seed,
  children,
  className,
}: WishlistThemeProps) {
  const emoji = normalizeThemeEmoji(themeEmoji);
  const style: WishlistThemeStyle | undefined = wishlistThemeStyle(themeColor);
  const pageBackground = themeTint(themeColor, PAGE_BACKGROUND_ALPHA);

  return (
    <div
      data-wl-theme={themeColor ?? 'default'}
      data-theme={themeColor ?? 'default'}
      data-wl-emoji={emoji ?? undefined}
      className={['relative', className ?? ''].join(' ').trim()}
      style={style}
    >
      {pageBackground ? (
        <div
          data-wl-page-background="true"
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{ zIndex: 0, backgroundColor: pageBackground }}
        />
      ) : null}

      {emoji ? <WishlistEmojiBackdrop emoji={emoji} seed={seed} /> : null}

      {/* Контент всегда выше фоновых слоёв темы и эмодзи. */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

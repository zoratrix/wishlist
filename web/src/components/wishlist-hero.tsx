import type { ReactNode } from 'react';
import { themeHeroTint, themeStripStyle } from '../lib/wishlist-theme';

export interface WishlistHeroProps {
  coverPath: string | null;
  themeColor: string | null;
  children: ReactNode;
  className?: string;
}

/**
 * Шапка вишлиста: обложка (если есть) + оттенок и акцентная полоса цвета темы.
 * Логика темы сохранена: при заданном цвете подсвечиваются подложка, полоса и обводка шапки.
 */
export function WishlistHero({ coverPath, themeColor, children, className }: WishlistHeroProps) {
  return (
    <div
      data-cover={coverPath ? 'true' : 'false'}
      data-theme={themeColor ?? 'default'}
      className={[
        'overflow-hidden rounded-3xl border border-line bg-card nb-soft-shadow',
        className ?? '',
      ]
        .join(' ')
        .trim()}
      style={
        themeColor
          ? { borderColor: themeColor, backgroundColor: themeHeroTint(themeColor) }
          : undefined
      }
    >
      {themeColor ? (
        <div
          aria-hidden="true"
          className="h-1.5 w-full"
          style={themeStripStyle(themeColor)}
        />
      ) : null}
      {coverPath ? (
        <img
          src={coverPath}
          alt="Обложка вишлиста"
          loading="lazy"
          className="h-36 w-full border-b border-line object-cover md:h-52"
        />
      ) : null}
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}

import type { ReactNode } from 'react';

export interface WishlistHeroProps {
  coverPath: string | null;
  themeColor: string | null;
  children: ReactNode;
  className?: string;
}

/**
 * Шапка вишлиста: обложка (если есть) + белая карточка с тонкой чёрной
 * рамкой, как у кнопок. Цветная полоса сверху убрана; тема оформления
 * остаётся в фоне страницы, акцентных кнопках и мягких подложках.
 */
export function WishlistHero({ coverPath, themeColor, children, className }: WishlistHeroProps) {
  return (
    <div
      data-cover={coverPath ? 'true' : 'false'}
      data-theme={themeColor ?? 'default'}
      className={[
        'overflow-hidden rounded-3xl border border-ink bg-card nb-soft-shadow',
        className ?? '',
      ]
        .join(' ')
        .trim()}
    >
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

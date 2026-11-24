import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { WishlistSummaryDTO } from '../lib/types';
import { formatDate, giftsCountLabel, visibilityLabel } from '../lib/format';
import { LinkifiedText } from './linkified-text';

export interface WishlistCardProps {
 wishlist: WishlistSummaryDTO;
 /** Куда ведёт карточка (редактор или публичная страница). */
 href: string;
 /** Дополнительная кнопка карточки, например «Редактировать» у владельца. */
 action?: ReactNode;
}

/**
 * Карточка вишлиста: название, описание, число подарков, дата, бейдж доступа.
 * Необрутализм: рамка 2px, жёсткая тень 4px, сдвиг при наведении, бейдж-стикер.
 */
export function WishlistCard({ wishlist, href, action }: WishlistCardProps) {
 const meta = [formatDate(wishlist.eventDate), giftsCountLabel(wishlist.giftCount)]
 .filter(Boolean)
 .join(' · ');

 const content = (
 <>
 <div className="flex items-start justify-between gap-3">
 <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-ink group-hover:underline group-hover:underline-offset-2">
 {wishlist.title}
 </h2>
 <span className="nb-badge shrink-0 bg-butter-soft px-2.5 py-1.5 text-[11px] font-medium text-ink">
 {visibilityLabel(wishlist.visibility)}
 </span>
 </div>
 {wishlist.description ? (
 <LinkifiedText text={wishlist.description} className="mt-1 line-clamp-2 text-sm font-medium text-muted" />
 ) : null}
 <p className="mt-2 text-xs text-muted">{meta}</p>
 </>
 );

 if (!action) {
 return (
 <Link to={href} className="group nb-card block p-5 transition-transform hover:-translate-y-0.5">
 {content}
 </Link>
 );
 }

 return (
 <div className="group nb-card p-5">
 <Link to={href} className="block">
 {content}
 </Link>
 <div className="mt-3 flex justify-end">{action}</div>
 </div>
 );
}

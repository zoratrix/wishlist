import { CategoryChips } from './category-chips';
import { GiftPrice, PriorityBadge, StatusBadge } from './gift-badges';
import { GiftLinks } from './gift-links';
import { LinkifiedText } from './linkified-text';
import type { GiftViewProps } from './gift-views';

/**
 * «Карточки»: сетка 1 / 2 / 3 / 4 колонки; описание до 4 строк; все ссылки кнопками.
 * Необрутализм: карточка-наклейка с чёрной рамкой 2px и жёсткой тенью.
 */
export function GiftCardsView({ gifts, adapter }: GiftViewProps) {
 return (
 <div data-view="cards">
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
 {gifts.map((gift) => {
 const status = adapter.getStatus(gift);
 const actions = adapter.renderActions(gift);

 return (
 <article
 key={gift.id}
 data-gift-id={gift.id}
 className="flex min-h-full flex-col rounded-2xl border border-ink bg-card p-4 transition-shadow "
 >
 <div className="flex items-start justify-between gap-2">
 <h3 className="min-w-0 break-words text-base font-bold leading-tight text-ink">
 {gift.title}
 </h3>
 <GiftPrice
 priceMinor={gift.priceMinor}
 className="shrink-0 rounded-md border border-line bg-butter-soft px-2 py-1 text-sm font-semibold leading-none text-ink"
 />
 </div>

 <div className="mt-2 flex flex-wrap items-center gap-1.5">
 <PriorityBadge priority={gift.priority} />
 <StatusBadge status={status} />
 </div>

 <CategoryChips categories={gift.categories} className="mt-2" />

 {gift.description ? (
 <LinkifiedText
 text={gift.description}
 className="mt-2 line-clamp-4 text-sm font-medium text-muted"
 />
 ) : null}

 <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
 <GiftLinks links={gift.links} variant="card" />
 {actions}
 </div>
 </article>
 );
 })}
 </div>
 </div>
 );
}

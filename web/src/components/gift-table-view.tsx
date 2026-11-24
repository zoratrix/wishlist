import { Fragment } from 'react';
import type { GiftDTO } from '../lib/types';
import { useMediaQuery } from '../hooks/use-media-query';
import { CategoryChips } from './category-chips';
import { GiftPrice, PriorityMark, StatusBadge } from './gift-badges';
import type { GiftStatusView } from './gift-badges';
import { GiftLinks } from './gift-links';
import { LinkifiedText } from './linkified-text';
import type { GiftViewProps } from './gift-views';

function CompactContent({ gift, status }: { gift: GiftDTO; status: GiftStatusView }) {
 return (
 <span className="min-w-0 flex-1">
 <span className="flex items-start justify-between gap-2">
 <span className="line-clamp-2 min-w-0 text-base font-bold leading-tight text-ink">
 {gift.title}
 </span>
 <GiftPrice priceMinor={gift.priceMinor} className="shrink-0 text-sm font-bold text-ink" />
 </span>
 <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
 <PriorityMark priority={gift.priority} />
 <StatusBadge status={status} />
 <CategoryChips categories={gift.categories} />
 </span>
 </span>
 );
}

function DescriptionText({ gift }: { gift: GiftDTO }) {
 if (!gift.description) {
 return <span className="text-sm font-bold text-muted">—</span>;
 }
 return (
 <LinkifiedText text={gift.description} className="line-clamp-3 text-sm font-medium text-muted" />
 );
}

/**
 * «Таблица»: на телефоне компактные строки-наклейки, с 768px — редактируемая
 * таблица с чёрными границами, жирной шапкой и подсветкой строки при наведении.
 * Колонка «Описание» — с 1024px, растягивается и обрезается до 3 строк.
 */
export function GiftTableView({ gifts, adapter }: GiftViewProps) {
 const isWide = useMediaQuery('(min-width: 768px)');

 if (!isWide) {
 return (
 <div data-view="table" className="space-y-3">
 {gifts.map((gift, index) => {
 const status = adapter.getStatus(gift);
 const actions = adapter.renderActions(gift);

 return (
 <div
 key={gift.id}
 data-gift-id={gift.id}
 className="overflow-hidden rounded-2xl border border-ink bg-card transition-shadow "
 >
 <div className="flex min-h-16 items-center gap-3 px-3 py-2.5">
 <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-butter-soft text-xs font-semibold tabular-nums text-ink">
 {index + 1}
 </span>
 <div className="flex min-w-0 flex-1 items-center gap-2">
 <CompactContent gift={gift} status={status} />
 </div>
 </div>

 {gift.links.length > 0 || actions ? (
 <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-3 py-2">
 <GiftLinks links={gift.links} variant="compact" />
 {actions}
 </div>
 ) : null}
 </div>
 );
 })}
 </div>
 );
 }

 return (
 <div
 data-view="table"
 className="overflow-x-auto rounded-2xl border border-ink bg-card"
 >
 <table className="w-full table-fixed border-collapse text-left">
 <thead>
 <tr className="border-b border-line bg-paper text-[11px] uppercase tracking-wide text-ink">
 <th scope="col" className="w-10 px-3 py-2.5 font-semibold">
 №
 </th>
 <th scope="col" className="w-[20%] px-3 py-2.5 font-semibold">
 Название
 </th>
 <th scope="col" className="hidden w-[30%] px-3 py-2.5 font-semibold lg:table-cell lg:w-[22%] xl:w-[30%]">
 Описание
 </th>
 <th scope="col" className="w-[4.5rem] px-3 py-2.5 font-semibold xl:w-[6.5rem]">
 Приоритет
 </th>
 <th scope="col" className="w-20 px-3 py-2.5 text-right font-semibold xl:w-28">
 Цена
 </th>
 <th scope="col" className="w-[6.5rem] px-3 py-2.5 font-semibold xl:w-36">
 Ссылки
 </th>
 <th scope="col" className="w-[6.5rem] px-3 py-2.5 font-semibold xl:w-[8rem]">
 Статус
 </th>
 <th scope="col" className="w-[8.5rem] px-3 py-2.5 text-right font-semibold">
 Действия
 </th>
 </tr>
 </thead>
 <tbody>
 {gifts.map((gift, index) => {
 const status = adapter.getStatus(gift);
 const cells = adapter.cells;

 return (
 <Fragment key={gift.id}>
 <tr
 data-gift-id={gift.id}
 className="border-b border-line align-top transition-colors last:border-0 hover:bg-butter-soft/50"
 >
 <td className="px-3 py-2.5 text-xs font-bold tabular-nums text-muted">
 {index + 1}
 </td>
 <td className="px-3 py-2.5">
 {cells?.renderTitle ? (
 cells.renderTitle(gift)
 ) : (
 <span className="text-sm font-bold text-ink">{gift.title}</span>
 )}
 <CategoryChips categories={gift.categories} className="mt-1" />
 </td>
 <td className="hidden px-3 py-2.5 lg:table-cell">
 {cells?.renderDescription ? (
 cells.renderDescription(gift)
 ) : (
 <DescriptionText gift={gift} />
 )}
 </td>
 <td className="px-3 py-2.5">
 {cells?.renderPriority ? (
 cells.renderPriority(gift)
 ) : (
 <PriorityMark priority={gift.priority} />
 )}
 </td>
 <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums text-ink">
 {cells?.renderPrice ? (
 cells.renderPrice(gift)
 ) : (
 <GiftPrice priceMinor={gift.priceMinor} />
 )}
 </td>
 <td className="px-3 py-2.5">
 <GiftLinks links={gift.links} variant="table" />
 </td>
 <td className="px-3 py-2.5">
 <StatusBadge status={status} />
 </td>
 <td className="px-3 py-2.5">
 <div className="flex flex-wrap items-center justify-end gap-1 [&>*]:shrink-0">
 {adapter.renderActions(gift)}
 </div>
 </td>
 </tr>
 </Fragment>
 );
 })}
 {adapter.addRows}
 </tbody>
 </table>
 </div>
 );
}

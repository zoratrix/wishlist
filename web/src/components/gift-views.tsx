import type { ReactNode } from 'react';
import type { GiftDTO } from '../lib/types';
import type { GiftViewMode } from '../lib/view-mode';
import type { GiftStatusView } from './gift-badges';
import { GiftCardsView } from './gift-cards-view';
import { GiftTableView } from './gift-table-view';

/** Содержимое ячеек desktop-таблицы: редактор подставляет inline-поля, гость — текст. */
export interface GiftCellRenderers {
 renderTitle?: (gift: GiftDTO) => ReactNode;
 renderDescription?: (gift: GiftDTO) => ReactNode;
 renderPriority?: (gift: GiftDTO) => ReactNode;
 renderPrice?: (gift: GiftDTO) => ReactNode;
}

/**
 * Адаптер страницы: вид (таблица/карточки) общий, а статусы, действия и
 * редактирование у редактора и публичной страницы разные — передаются пропсами.
 */
export interface GiftViewAdapter {
 getStatus: (gift: GiftDTO) => GiftStatusView;
 renderActions: (gift: GiftDTO) => ReactNode;
 cells?: GiftCellRenderers;
 /** Строки под таблицей (в редакторе — строка добавления подарка). */
 addRows?: ReactNode;
}

export interface GiftViewProps {
 gifts: GiftDTO[];
 adapter: GiftViewAdapter;
}

export function GiftViews({
 view,
 gifts,
 adapter,
}: GiftViewProps & { view: GiftViewMode }) {
 if (view === 'cards') {
 return <GiftCardsView gifts={gifts} adapter={adapter} />;
 }
 return <GiftTableView gifts={gifts} adapter={adapter} />;
}

import { useState } from 'react';
import { pluralRu } from '../lib/format';
import { MAX_VISIBLE_LINKS, parseLinkHost } from '../lib/link-brand';
import { GiftLinkButton, LINK_BUTTON_SIZE_CLASS } from './gift-link-button';
import type { LinkButtonVariant } from './gift-link-button';

export type GiftLinksVariant = LinkButtonVariant;

export interface GiftLinksProps {
 links: string[];
 variant: GiftLinksVariant;
}

/**
 * «Ещё/свернуть» — та же квадратная наклейка, что и кнопки ссылок.
 * Размер берём из общего LINK_BUTTON_SIZE_CLASS, но держим тач-цель не меньше
 * 44×44 (min-h-11/min-w-11): на телефоне в таблицу тоже можно переключиться.
 */
const expandButtonClass = [
 'nb-focus relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center',
 // Зона нажатия шире самого квадрата — как у GiftLinkButton в ряду.
 "after:absolute after:-inset-0.5 after:content-['']",
 'border border-line bg-card font-bold text-ink hover:bg-accent-soft',
].join(' ');

/**
 * Ссылки подарка квадратными кнопками: до 6 видны сразу, остальные — за «＋N».
 * Небезопасные/невалидные ссылки (не http/https) отбрасываются. Без ссылок не рендерится.
 */
export function GiftLinks({ links, variant }: GiftLinksProps) {
 const [expanded, setExpanded] = useState(false);

 const safeLinks = links.filter((link) => parseLinkHost(link) !== null);
 if (safeLinks.length === 0) {
 return null;
 }

 const visible = expanded ? safeLinks : safeLinks.slice(0, MAX_VISIBLE_LINKS);
 const hiddenCount = safeLinks.length - MAX_VISIBLE_LINKS;

 return (
 <div className="flex flex-wrap items-center gap-1.5">
 {visible.map((url, index) => (
 <GiftLinkButton key={`${url}-${index}`} url={url} variant={variant} />
 ))}

 {hiddenCount > 0 ? (
 expanded ? (
 <button
 type="button"
 onClick={() => setExpanded(false)}
 aria-label="Свернуть ссылки"
 className={[expandButtonClass, LINK_BUTTON_SIZE_CLASS[variant]].join(' ')}
 >
 −
 </button>
 ) : (
 <button
 type="button"
 onClick={() => setExpanded(true)}
 aria-label={`Показать ещё ${hiddenCount} ${pluralRu(hiddenCount, 'ссылку', 'ссылки', 'ссылок')}`}
 className={[expandButtonClass, LINK_BUTTON_SIZE_CLASS[variant]].join(' ')}
 >
 ＋{hiddenCount}
 </button>
 )
 ) : null}
 </div>
 );
}

import { useState } from 'react';
import { detectLinkBrand, faviconUrl, parseLinkHost } from '../lib/link-brand';

export type LinkButtonVariant = 'table' | 'card' | 'compact';

/** Размеры квадратных кнопок: таблица 32, карточки/модалка 36, телефон 40. */
export const LINK_BUTTON_SIZE_CLASS: Record<LinkButtonVariant, string> = {
 table: 'h-8 w-8 rounded-md text-[10px]',
 card: 'h-10 w-10 rounded-md text-[11px] sm:h-9 sm:w-9',
 compact: 'h-10 w-10 rounded-md text-[11px]',
};

function GlobeIcon() {
 return (
 <svg
 aria-hidden="true"
 viewBox="0 0 20 20"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 className="h-4 w-4"
 >
 <circle cx="10" cy="10" r="7" />
 <path d="M3 10h14" />
 <path d="M10 3c2.2 2 2.2 12 0 14M10 3c-2.2 2-2.2 12 0 14" />
 </svg>
 );
}

export interface GiftLinkButtonProps {
 url: string;
 variant?: LinkButtonVariant;
}

/**
 * Маленькая квадратная кнопка-ссылка с иконкой сайта: монограмма на фирменном
 * цвете для известных брендов, нейтральный «глобус» для остальных.
 * Favicon подгружается опционально и не ломает вид при ошибке/без сети.
 * Необрутализм: чёрная рамка 2px и жёсткая тень у любого варианта.
 */
export function GiftLinkButton({ url, variant = 'card' }: GiftLinkButtonProps) {
 const host = parseLinkHost(url);
 const [faviconOk, setFaviconOk] = useState(false);
 const [faviconFailed, setFaviconFailed] = useState(false);

 // Небезопасные схемы (javascript: и т.п.) и мусор не превращаем в ссылку.
 if (host === null) {
 return null;
 }

 const brand = detectLinkBrand(host);
 const title = host;

 return (
 <a
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={`Открыть ссылку: ${title}`}
 title={title}
 data-brand={brand?.id ?? 'neutral'}
 style={brand === null ? undefined : { backgroundColor: brand.background, color: brand.textColor }}
 className={[
 'nb-focus relative inline-flex shrink-0 items-center justify-center border border-ink transition-transform hover:-translate-y-px active:translate-y-px',
 // ::after расширяет зону нажатия до 44px, не раздувая сам квадрат.
 "after:absolute after:-inset-0.5 after:content-['']",
 '',
 LINK_BUTTON_SIZE_CLASS[variant],
 brand === null ? 'bg-card text-ink' : 'font-bold',
 ].join(' ')}
 >
 {brand === null ? (
 <GlobeIcon />
 ) : (
 <>
 {faviconOk ? null : (
 <span aria-hidden="true" className="leading-none">
 {brand.label}
 </span>
 )}
 {faviconFailed ? null : (
 <img
 src={faviconUrl(host ?? title)}
 alt=""
 loading="lazy"
 referrerPolicy="no-referrer"
 onLoad={() => setFaviconOk(true)}
 onError={() => setFaviconFailed(true)}
 className={faviconOk ? 'h-4 w-4' : 'hidden'}
 />
 )}
 </>
 )}
 </a>
 );
}

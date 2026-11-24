import { MAX_GIFT_LINKS } from '../lib/links';

export interface LinksEditorProps {
 links: string[];
 onChange: (links: string[]) => void;
 /** Префикс для aria-label, чтобы отличать поля в формах. */
 labelPrefix?: string;
}

const inputClass = [
 'min-h-11 w-full min-w-0 rounded-lg border border-ink bg-card px-3 text-base text-ink',
 ' placeholder:text-muted',
 ' focus:outline-none',
].join(' ');

/**
 * Динамический список ссылок: поля «Ссылка на товар», «＋ Ещё ссылка» (до 10),
 * у каждой строки — «убрать».
 * Необрутализм: 2px чёрная рамка, жёсткая тень, тач-цели 44×44.
 */
export function LinksEditor({ links, onChange, labelPrefix = '' }: LinksEditorProps) {
 function updateLink(index: number, value: string) {
 onChange(links.map((link, currentIndex) => (currentIndex === index ? value : link)));
 }

 function removeLink(index: number) {
 onChange(links.filter((_link, currentIndex) => currentIndex !== index));
 }

 function addLink() {
 if (links.length >= MAX_GIFT_LINKS) {
 return;
 }
 onChange([...links, '']);
 }

 return (
 <div>
 <p className="text-sm font-semibold tracking-wide text-ink">Ссылки на товар</p>
 <div className="mt-2 space-y-2">
 {links.map((link, index) => (
 <div key={index} className="flex items-center gap-2">
 <input
 aria-label={`${labelPrefix}Ссылка на товар ${index + 1}`}
 type="url"
 inputMode="url"
 value={link}
 placeholder="https://…"
 maxLength={2000}
 onChange={(event) => updateLink(index, event.target.value)}
 className={inputClass}
 />
 <button
 type="button"
 onClick={() => removeLink(index)}
 aria-label={`${labelPrefix}Убрать ссылку ${index + 1}`}
 className={[
 'nb-focus flex h-11 w-11 shrink-0 items-center justify-center',
 'rounded-lg border border-line bg-card text-base font-semibold text-ink',
 'hover:bg-powder-soft hover:text-danger',
 ].join(' ')}
 >
 ✕
 </button>
 </div>
 ))}
 </div>

 {links.length < MAX_GIFT_LINKS ? (
 <button
 type="button"
 onClick={addLink}
 aria-label={`${labelPrefix}Добавить ссылку`}
 className={[
 'nb-focus mt-2 inline-flex min-h-11 items-center gap-1',
 'rounded-lg border border-ink bg-card px-3 text-sm font-bold text-ink',
 'hover:bg-accent-soft',
 ].join(' ')}
 >
 ＋ Ещё ссылка
 </button>
 ) : (
 <p className="mt-2 text-xs font-medium text-muted">
 Можно добавить не больше {MAX_GIFT_LINKS} ссылок.
 </p>
 )}
 </div>
 );
}

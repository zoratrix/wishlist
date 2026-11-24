import { splitLinkifiedText } from '../lib/linkify';

export interface LinkifiedTextProps {
 text: string | null;
 className?: string;
}

/** Текст, в котором http/https-ссылки кликабельны; переносы строк сохраняются. */
export function LinkifiedText({ text, className }: LinkifiedTextProps) {
 if (!text) {
 return null;
 }

 const parts = splitLinkifiedText(text);

 return (
 <span className={['whitespace-pre-line', className ?? ''].join(' ').trim()}>
 {parts.map((part, index) =>
 part.type === 'link' ? (
 <a
 key={`link-${index}`}
 href={part.value}
 target="_blank"
 rel="noopener noreferrer"
 className="break-words text-accent underline underline-offset-2 hover:text-accent/80"
 >
 {part.value}
 </a>
 ) : (
 <span key={`text-${index}`}>{part.value}</span>
 ),
 )}
 </span>
 );
}

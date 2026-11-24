/** Разбивает текст на части: обычный текст и http/https-ссылки. */

export interface LinkifiedPart {
  type: 'text' | 'link';
  value: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_CHARS = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  ')',
  ']',
  '}',
  '>',
  '»',
  '…',
  '"',
  "'",
  '`',
]);

/**
 * Находит ссылки и отрезает хвостовую пунктуацию.
 * Схемы кроме http/https (например javascript:) не линкуются.
 */
export function splitLinkifiedText(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    let url = raw;
    let trailing = '';
    while (url.length > 0 && TRAILING_CHARS.has(url[url.length - 1] as string)) {
      trailing = `${url[url.length - 1] as string}${trailing}`;
      url = url.slice(0, -1);
    }

    if (url.length > 0) {
      parts.push({ type: 'link', value: url });
    }
    if (trailing !== '') {
      parts.push({ type: 'text', value: trailing });
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

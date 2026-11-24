/** Ссылки на товар: до 10 штук, каждая — валидный http/https URL. */

export const MAX_GIFT_LINKS = 10;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** trim, пустые убрать, дубликаты убрать (порядок сохраняется). */
export function normalizeLinks(values: readonly string[]): string[] {
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (value === '' || result.includes(value)) {
      continue;
    }
    result.push(value);
  }
  return result;
}

/** Текст ошибки или null, если массив валиден. */
export function validateLinks(values: readonly string[]): string | null {
  const links = normalizeLinks(values);
  if (links.length > MAX_GIFT_LINKS) {
    return `Можно добавить не больше ${MAX_GIFT_LINKS} ссылок.`;
  }
  for (const value of links) {
    if (!isHttpUrl(value)) {
      return 'Ссылка должна начинаться с http:// или https://.';
    }
  }
  return null;
}

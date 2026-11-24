/** Бренд ссылки: фирменный цвет и короткая монограмма (без внешних картинок). */

export interface LinkBrand {
  id: string;
  /** Монограмма/буквы на кнопке. */
  label: string;
  background: string;
  textColor: string;
}

const BRAND_ENTRIES: Array<{ domains: string[]; brand: LinkBrand }> = [
  {
    domains: ['ozon.ru'],
    brand: { id: 'ozon', label: 'O', background: '#005BFF', textColor: '#FFFFFF' },
  },
  {
    domains: ['wildberries.ru', 'wb.ru'],
    brand: { id: 'wildberries', label: 'WB', background: '#CB11AB', textColor: '#FFFFFF' },
  },
  {
    domains: ['market.yandex.ru'],
    brand: { id: 'yandex-market', label: 'Я', background: '#FC3F1D', textColor: '#FFFFFF' },
  },
  {
    domains: ['avito.ru'],
    brand: { id: 'avito', label: 'A', background: '#00AAFF', textColor: '#FFFFFF' },
  },
  {
    domains: ['aliexpress.ru'],
    brand: { id: 'aliexpress', label: 'ALI', background: '#E62E04', textColor: '#FFFFFF' },
  },
  {
    domains: ['dns-shop.ru'],
    brand: { id: 'dns', label: 'DNS', background: '#F8B301', textColor: '#1F1F1F' },
  },
  {
    domains: ['mvideo.ru'],
    brand: { id: 'mvideo', label: 'M', background: '#E60000', textColor: '#FFFFFF' },
  },
  {
    domains: ['detmir.ru'],
    brand: { id: 'detmir', label: 'Д', background: '#00A0E3', textColor: '#FFFFFF' },
  },
  {
    domains: ['litres.ru'],
    brand: { id: 'litres', label: 'Л', background: '#3B3B3B', textColor: '#FFFFFF' },
  },
];

export const MAX_VISIBLE_LINKS = 6;

/** Host без www; null для невалидных/не-http ссылок. */
export function parseLinkHost(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    return host === '' ? null : host;
  } catch {
    return null;
  }
}

/** Фирменный стиль по host (включая поддомены) или null → нейтральная кнопка. */
export function detectLinkBrand(host: string): LinkBrand | null {
  const normalized = host.toLowerCase();
  for (const entry of BRAND_ENTRIES) {
    for (const domain of entry.domains) {
      if (normalized === domain || normalized.endsWith(`.${domain}`)) {
        return entry.brand;
      }
    }
  }
  return null;
}

/** Необязательное улучшение: favicon с российского сервиса (может быть заблокирован). */
export function faviconUrl(host: string): string {
  return `https://favicon.yandex.net/favicon/${encodeURIComponent(host)}`;
}

/** Выбранный вид подарков — общий для редактора и публичной страницы. */

export type GiftViewMode = 'table' | 'cards';

export const VIEW_MODE_KEY = 'wl:view-mode:v1';
export const DEFAULT_VIEW_MODE: GiftViewMode = 'table';

export interface ViewModeOption {
  value: GiftViewMode;
  label: string;
}

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { value: 'table', label: 'Таблица' },
  { value: 'cards', label: 'Карточки' },
];

function isViewMode(value: unknown): value is GiftViewMode {
  return value === 'table' || value === 'cards';
}

/**
 * Сохранённый выбор. Старый режим «Строки» (rows) мигрируем в «Таблица»
 * и сразу перезаписываем, чтобы он больше не всплывал.
 */
export function readViewMode(): GiftViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    if (stored === 'rows') {
      writeViewMode(DEFAULT_VIEW_MODE);
      return DEFAULT_VIEW_MODE;
    }
    return isViewMode(stored) ? stored : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function writeViewMode(mode: GiftViewMode): void {
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Storage может быть запрещён — выбор просто не сохранится.
  }
}

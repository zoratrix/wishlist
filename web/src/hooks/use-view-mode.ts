import { useCallback, useState } from 'react';
import { readViewMode, writeViewMode } from '../lib/view-mode';
import type { GiftViewMode } from '../lib/view-mode';

/** Текущий вид подарков + сохранение выбора в localStorage. */
export function useViewMode(): [GiftViewMode, (mode: GiftViewMode) => void] {
  const [mode, setMode] = useState<GiftViewMode>(() => readViewMode());

  const changeMode = useCallback((next: GiftViewMode) => {
    setMode(next);
    writeViewMode(next);
  }, []);

  return [mode, changeMode];
}

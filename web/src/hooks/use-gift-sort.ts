import { useCallback, useState } from 'react';
import { readGiftSort, writeGiftSort } from '../lib/sort';
import type { GiftSort } from '../lib/sort';

/** Текущая сортировка подарков + сохранение выбора в localStorage. */
export function useGiftSort(): [GiftSort, (sort: GiftSort) => void] {
  const [sort, setSort] = useState<GiftSort>(() => readGiftSort());

  const changeSort = useCallback((next: GiftSort) => {
    setSort(next);
    writeGiftSort(next);
  }, []);

  return [sort, changeSort];
}

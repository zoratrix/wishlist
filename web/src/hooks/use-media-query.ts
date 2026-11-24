import { useEffect, useState } from 'react';

/**
 * Подписка на медиазапрос. Нужна, чтобы на широком экране отрисовать настоящую
 * таблицу, а на телефоне — компактные строки (без дублирования кнопок в DOM).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const list = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', handleChange);
      return () => list.removeEventListener('change', handleChange);
    }

    // Старые движки: у MediaQueryList был только addListener.
    list.addListener(handleChange);
    return () => list.removeListener(handleChange);
  }, [query]);

  return matches;
}

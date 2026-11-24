import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// После каждого теста убираем отрисованный DOM и подменённые глобальные функции.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    // Storage может быть подменён тестом (например, имитация запрета записи).
  }
});

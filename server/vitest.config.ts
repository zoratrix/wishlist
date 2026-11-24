import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Потоки вместо отдельных процессов: быстрее и не требует spawn.
    pool: 'threads',
    reporters: ['default'],
  },
});

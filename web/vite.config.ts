import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// В разработке Vite работает как middleware внутри сервера (см. server/src/dev.ts):
// отдельный порт и прокси не нужны. Здесь — только плагины и сборка.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Без встроенного полифила: страницу отдаёт наш сервер со строгим CSP.
    modulePreload: { polyfill: false },
  },
});

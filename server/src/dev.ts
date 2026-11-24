import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { closeDb } from './db/index.ts';
import { pendingMigrationNames } from './db/migrate.ts';
import { logger } from './logger.ts';

/**
 * Режим разработки: один процесс и один адрес http://localhost:3000.
 * Vite работает как middleware внутри Express — фронтенд получает мгновенные
 * обновления (HMR), API находится на том же адресе, прокси не нужен.
 */
async function main(): Promise<void> {
  const pending = pendingMigrationNames();
  if (pending.length > 0) {
    logger.error(`База данных не готова. Не применены миграции: ${pending.join(', ')}`);
    logger.error('Выполните команду: npm run db:migrate');
    process.exit(1);
  }

  fs.mkdirSync(config.uploadDir, { recursive: true });

  // Vite создаётся асинхронно, а Express уже должен быть собран.
  // Поэтому подключаем «прослойку», которая заработает сразу после создания Vite.
  let viteMiddleware: RequestHandler | null = null;

  const app = createApp({
    serveBuiltSite: false,
    siteMiddleware: (req, res, next) => {
      if (viteMiddleware) {
        viteMiddleware(req, res, next);
      } else {
        next();
      }
    },
  });

  const server = http.createServer(app);

  const vite: ViteDevServer = await createViteServer({
    root: path.join(config.rootDir, 'web'),
    configFile: path.join(config.rootDir, 'web', 'vite.config.ts'),
    appType: 'spa',
    server: {
      middlewareMode: true,
      // HMR работает через тот же HTTP-сервер — отдельный порт не нужен
      // (и не может конфликтовать с другими запусками).
      hmr: { server },
    },
  });

  viteMiddleware = vite.middlewares;

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        `Порт ${config.PORT} уже занят. Скорее всего, сайт уже запущен в другом окне терминала.`,
      );
      logger.error('Закройте старое окно с сайтом или измените PORT в файле .env и запустите снова.');
      process.exit(1);
    }
    logger.error('Ошибка сервера', error);
    process.exit(1);
  });

  server.listen(config.PORT, config.HOST, () => {
    logger.info(`Сайт и API запущены: http://localhost:${config.PORT}`);
    logger.info(`Проверка сервера: http://${config.HOST}:${config.PORT}/api/health`);
    logger.info(`Режим: разработка (Vite + Express в одном процессе)`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`Получен ${signal}. Останавливаюсь…`);
    void vite.close().finally(() => {
      server.close(() => {
        closeDb();
        process.exit(0);
      });
    });
    setTimeout(() => {
      logger.warn('Принудительное завершение.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error('Не удалось запустить режим разработки', error);
  process.exit(1);
});

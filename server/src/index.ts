import fs from 'node:fs';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { closeDb } from './db/index.ts';
import { pendingMigrationNames } from './db/migrate.ts';
import { logger } from './logger.ts';

function main(): void {
  // Дружелюбная проверка: база должна быть готова.
  let pending: string[] = [];
  try {
    pending = pendingMigrationNames();
  } catch (error) {
    logger.error('Не удалось открыть базу данных', error);
    logger.error(`Путь базы: ${config.databasePath}`);
    process.exit(1);
  }

  if (pending.length > 0) {
    logger.error(`База данных не готова. Не применены миграции: ${pending.join(', ')}`);
    logger.error('Выполните команду: npm run db:migrate');
    process.exit(1);
  }

  fs.mkdirSync(config.uploadDir, { recursive: true });

  const app = createApp();
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(`Сервер запущен: http://${config.HOST}:${config.PORT}`);
    logger.info(`Проверка: http://${config.HOST}:${config.PORT}/api/health`);
    logger.info(`Режим: ${config.NODE_ENV}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Порт ${config.PORT} уже занят. Закройте старое окно с сайтом или измените PORT в .env.`);
      process.exit(1);
    }
    logger.error('Ошибка сервера', error);
    process.exit(1);
  });

  const shutdown = (signal: string): void => {
    logger.info(`Получен ${signal}. Останавливаюсь…`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    // Страховка: если соединения не закрылись за 5 секунд — выходим принудительно.
    setTimeout(() => {
      logger.warn('Принудительное завершение.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();

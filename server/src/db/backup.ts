import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from '../config.ts';
import { getDb, closeDb } from './index.ts';
import { logger } from '../logger.ts';

/**
 * Резервная копия работающей базы через VACUUM INTO:
 * консистентный снимок, сервер останавливать не нужно.
 * ВАЖНО: восстановленная таким способом копия открывается в journal_mode=delete —
 * после восстановления сервер сам включает WAL при старте.
 */
export function backupDatabase(): string {
  const backupsDir = path.join(config.rootDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const targetPath = path.join(backupsDir, `app-${stamp}.db`);

  // Экранируем одинарные кавычки в пути (SQLite-строка).
  const escaped = targetPath.replace(/'/g, "''");
  getDb().exec(`VACUUM INTO '${escaped}'`);

  return targetPath;
}

// Прямой запуск: npm run db:backup
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    const file = backupDatabase();
    logger.info(`Резервная копия создана: ${file}`);
    closeDb();
    process.exit(0);
  } catch (error) {
    logger.error('Не удалось создать резервную копию', error);
    closeDb();
    process.exit(1);
  }
}

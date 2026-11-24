import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

/**
 * Тестовое окружение: отдельная временная база на каждый файл тестов.
 * Переменные задаются ДО импорта конфигурации приложения.
 */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishlist-test-'));
const databasePath = path.join(tempDir, 'test.db');
const uploadDir = path.join(tempDir, 'uploads');

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = databasePath;
process.env.UPLOAD_DIR = uploadDir;
process.env.SESSION_SECRET = 'test-session-secret-0123456789';
process.env.HASH_SECRET = 'test-hash-secret-0123456789';
process.env.APP_URL = 'http://localhost:5173';
// Почта в тестах не настроена: письма не уходят, ссылка пишется в журнал и
// (вне production) приходит в ответе forgot-password как debugUrl.
process.env.SMTP_HOST = '';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.HOST = '127.0.0.1';
process.env.PORT = '0';
process.env.TZ = 'Europe/Moscow';
process.env.LOG_LEVEL = 'warn';

// Динамические импорты: конфигурация читает переменные при импорте.
const { runMigrations } = await import('../src/db/migrate.ts');
const { closeDb } = await import('../src/db/index.ts');

runMigrations();

afterAll(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

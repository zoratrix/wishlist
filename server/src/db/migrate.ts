import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, closeDb, type SqliteDatabase } from './index.ts';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

// Миграции лежат в server/db/migrations (вне исходного кода), поэтому
// одинаково находятся и в разработке, и в собранной версии.
const MIGRATIONS_DIR = path.join(config.serverDir, 'db', 'migrations');

export interface Migration {
  readonly name: string;
  readonly sql: string;
}

/** Миграции — обычные SQL-файлы, применяются в порядке имени. */
export function listMigrations(): Migration[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'),
    }));
}

function ensureMigrationsTable(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
}

/** Возвращает имена применённых миграций. */
export function appliedMigrationNames(database: SqliteDatabase = getDb()): string[] {
  const hasTable = database
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (!hasTable) return [];
  const rows = database.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

/** Какие миграции ещё не применены. */
export function pendingMigrationNames(database: SqliteDatabase = getDb()): string[] {
  const applied = new Set(appliedMigrationNames(database));
  return listMigrations()
    .map((migration) => migration.name)
    .filter((name) => !applied.has(name));
}

/**
 * Применяет неприменённые миграции в транзакции.
 * Возвращает список применённых файлов.
 */
export function runMigrations(database: SqliteDatabase = getDb()): string[] {
  ensureMigrationsTable(database);
  const applied = new Set(appliedMigrationNames(database));
  const record = database.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');
  const newlyApplied: string[] = [];

  for (const migration of listMigrations()) {
    if (applied.has(migration.name)) continue;
    const applyOne = database.transaction(() => {
      database.exec(migration.sql);
      record.run(migration.name, new Date().toISOString());
    });
    applyOne();
    newlyApplied.push(migration.name);
  }

  return newlyApplied;
}

// Прямой запуск: npm run db:migrate
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    const applied = runMigrations();
    if (applied.length === 0) {
      logger.info('Все миграции уже применены.');
    } else {
      logger.info(`Применены миграции: ${applied.join(', ')}`);
    }
    closeDb();
    process.exit(0);
  } catch (error) {
    logger.error('Не удалось применить миграции', error);
    closeDb();
    process.exit(1);
  }
}

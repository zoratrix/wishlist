import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.ts';

export type SqliteDatabase = Database.Database;

let instance: SqliteDatabase | null = null;

/**
 * Открывает базу и применяет обязательные PRAGMA.
 * WAL: один писатель + много читателей; busy_timeout: ждать блокировку вместо
 * мгновенной ошибки; foreign_keys: работают каскады и целостность.
 */
export function openDatabase(filePath: string): SqliteDatabase {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  database.pragma('foreign_keys = ON');
  database.pragma('synchronous = NORMAL');
  return database;
}

/** Одно соединение на процесс (better-sqlite3 синхронный, этого достаточно). */
export function getDb(): SqliteDatabase {
  instance ??= openDatabase(config.databasePath);
  return instance;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

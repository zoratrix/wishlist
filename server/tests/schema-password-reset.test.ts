import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import { appliedMigrationNames } from '../src/db/migrate.ts';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'migrations',
);

function migrationSql(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
}

function tableColumns(database: Database.Database, table: string): string[] {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function indexNames(database: Database.Database, table: string): string[] {
  const rows = database.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

describe('миграция 009 (восстановление пароля)', () => {
  it('применена к живой схеме: таблица и обязательные колонки на месте', () => {
    expect(appliedMigrationNames(getDb())).toContain('009_password_resets.sql');

    const columns = tableColumns(getDb(), 'password_resets');
    expect(columns).toEqual([
      'id',
      'user_id',
      'token_hash',
      'expires_at',
      'used_at',
      'created_at',
    ]);
  });

  it('создаёт индексы по user_id и expires_at', () => {
    const indexes = indexNames(getDb(), 'password_resets');
    expect(indexes).toContain('password_resets_user_id_idx');
    expect(indexes).toContain('password_resets_expires_at_idx');
  });

  it('запрещает дубли token_hash и удаляет ссылки вместе с пользователем', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(migrationSql('001_init.sql'));
    db.exec(migrationSql('009_password_resets.sql'));

    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(now, now);

    const insert = db.prepare(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at)
       VALUES (?, 'u1', ?, ?, NULL, ?)`,
    );
    insert.run('r1', 'hash-1', now, now);
    expect(() => insert.run('r2', 'hash-1', now, now)).toThrow(/UNIQUE/);

    db.prepare("DELETE FROM users WHERE id = 'u1'").run();
    expect(db.prepare('SELECT COUNT(*) AS count FROM password_resets').get()).toEqual({ count: 0 });

    db.close();
  });
});

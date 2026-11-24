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

function columnInfo(
  database: Database.Database,
  table: string,
  column: string,
): { notnull: number; dflt_value: string | null } | undefined {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
    notnull: number;
    dflt_value: string | null;
  }>;
  return rows.find((row) => row.name === column);
}

describe('миграция 007 (эмодзи-оформление вишлиста)', () => {
  it('применена к живой схеме: у wishlists есть nullable theme_emoji', () => {
    expect(appliedMigrationNames(getDb())).toContain('007_wishlist_emoji.sql');
    expect(tableColumns(getDb(), 'wishlists')).toContain('theme_emoji');

    const column = columnInfo(getDb(), 'wishlists', 'theme_emoji');
    expect(column).toBeDefined();
    expect(column?.notnull).toBe(0);
    expect(column?.dflt_value).toBeNull();
  });

  it('добавляет theme_emoji и не теряет существующие данные', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const name of [
      '001_init.sql',
      '002_gift_links.sql',
      '003_categories_scope.sql',
      '004_category_color.sql',
      '005_category_color_muted.sql',
      '006_wishlist_theme.sql',
    ]) {
      db.exec(migrationSql(name));
    }

    const timestamp = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO wishlists (id, owner_id, title, share_token, created_at, updated_at) VALUES ('w1', 'u1', 'Список', 'token-1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO gifts (id, wishlist_id, title, created_at, updated_at) VALUES ('g1', 'w1', 'Подарок', ?, ?)",
    ).run(timestamp, timestamp);

    expect(tableColumns(db, 'wishlists')).not.toContain('theme_emoji');
    db.exec(migrationSql('007_wishlist_emoji.sql'));

    expect(tableColumns(db, 'wishlists')).toContain('theme_emoji');
    // Существующий вишлист получает NULL и остаётся на месте вместе с подарком.
    expect(db.prepare('SELECT theme_emoji FROM wishlists WHERE id = ?').get('w1')).toEqual({
      theme_emoji: null,
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM gifts WHERE wishlist_id = 'w1'").get()).toEqual({
      count: 1,
    });
    expect(db.prepare('SELECT title FROM wishlists WHERE id = ?').get('w1')).toEqual({
      title: 'Список',
    });

    db.prepare('UPDATE wishlists SET theme_emoji = ? WHERE id = ?').run('🎁', 'w1');
    expect(db.prepare('SELECT theme_emoji FROM wishlists WHERE id = ?').get('w1')).toEqual({
      theme_emoji: '🎁',
    });
    db.close();
  });
});

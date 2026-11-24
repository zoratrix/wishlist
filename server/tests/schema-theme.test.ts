import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';

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

describe('миграция 006 (цвет-тема вишлиста)', () => {
  it('в живой схеме у wishlists есть nullable theme_color', () => {
    expect(tableColumns(getDb(), 'wishlists')).toContain('theme_color');
  });

  it('добавляет theme_color и не теряет существующие данные', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const name of [
      '001_init.sql',
      '002_gift_links.sql',
      '003_categories_scope.sql',
      '004_category_color.sql',
      '005_category_color_muted.sql',
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

    db.exec(migrationSql('006_wishlist_theme.sql'));

    expect(tableColumns(db, 'wishlists')).toContain('theme_color');
    // Существующий вишлист получает NULL и остаётся на месте вместе с подарком.
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w1')).toEqual({
      theme_color: null,
    });
    expect(db.prepare("SELECT COUNT(*) AS count FROM gifts WHERE wishlist_id = 'w1'").get()).toEqual({
      count: 1,
    });

    db.prepare('UPDATE wishlists SET theme_color = ? WHERE id = ?').run('#C4574D', 'w1');
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w1')).toEqual({
      theme_color: '#C4574D',
    });
    db.close();
  });
});

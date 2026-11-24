import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';

const now = () => new Date().toISOString();

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

function tableNames(): string[] {
  const rows = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function createGift(): string {
  const db = getDb();
  const id = `gift-${Math.random().toString(36).slice(2, 10)}`;
  db.prepare(
    "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('seed-user', 'seed@example.com', 'seeduser', 'Seed', ?, ?) ON CONFLICT DO NOTHING",
  ).run(now(), now());
  db.prepare(
    "INSERT INTO wishlists (id, owner_id, title, share_token, created_at, updated_at) VALUES ('seed-list', 'seed-user', 'Список', 'seed-token', ?, ?) ON CONFLICT DO NOTHING",
  ).run(now(), now());
  db.prepare(
    'INSERT INTO gifts (id, wishlist_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, 'seed-list', 'Тестовый подарок', now(), now());
  return id;
}

describe('схема базы данных', () => {
  it('создаёт все таблицы из миграции', () => {
    const names = tableNames();
    const expected = [
      'users',
      'oauth_accounts',
      'sessions',
      'email_tokens',
      'password_resets',
      'user_settings',
      'follows',
      'wishlists',
      'gifts',
      'gift_links',
      'categories',
      'gift_categories',
      'bookings',
      'booking_attempts',
      'notifications',
      'email_outbox',
      'schema_migrations',
    ];
    for (const table of expected) {
      expect(names, `нет таблицы ${table}`).toContain(table);
    }
  });

  it('создаёт частичный уникальный индекс для активных броней', () => {
    const index = getDb()
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'bookings_one_active_per_gift'")
      .get() as { name: string; sql: string } | undefined;

    expect(index).toBeDefined();
    expect(index?.sql ?? '').toContain('WHERE cancelled_at IS NULL');
  });

  it('запрещает две активные брони на один подарок', () => {
    const db = getDb();
    const giftId = createGift();
    const insertBooking = db.prepare(`
      INSERT INTO bookings (id, gift_id, customer_name, customer_email, customer_email_norm, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertBooking.run(`b-${giftId}-1`, giftId, 'Первый гость', 'one@example.com', 'one@example.com', now());
    expect(() =>
      insertBooking.run(`b-${giftId}-2`, giftId, 'Второй гость', 'two@example.com', 'two@example.com', now()),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('разрешает новую бронь после отмены предыдущей', () => {
    const db = getDb();
    const giftId = createGift();
    const insertBooking = db.prepare(`
      INSERT INTO bookings (id, gift_id, customer_name, customer_email, customer_email_norm, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertBooking.run(`c-${giftId}-1`, giftId, 'Гость', 'guest@example.com', 'guest@example.com', now());
    db.prepare('UPDATE bookings SET cancelled_at = ?, cancelled_reason = ? WHERE gift_id = ? AND cancelled_at IS NULL').run(
      now(),
      'visitor',
      giftId,
    );

    expect(() =>
      insertBooking.run(`c-${giftId}-2`, giftId, 'Другой гость', 'other@example.com', 'other@example.com', now()),
    ).not.toThrow();
  });

  it('не позволяет подписаться на самого себя', () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('follow-user', 'follow@example.com', 'followuser', 'Follow', ?, ?) ON CONFLICT DO NOTHING",
    ).run(now(), now());

    expect(() =>
      db
        .prepare(
          "INSERT INTO follows (id, follower_id, following_id, created_at) VALUES ('self-follow', 'follow-user', 'follow-user', ?)",
        )
        .run(now()),
    ).toThrow(/CHECK constraint failed/);
  });

  it('не позволяет включить имена бронирующих при скрытых бронях', () => {
    const db = getDb();
    expect(() =>
      db
        .prepare(
          "INSERT INTO wishlists (id, owner_id, title, share_token, show_booked, show_booker_names, created_at, updated_at) VALUES ('bad-list', 'seed-user', 'Плохой список', 'bad-token', 0, 1, ?, ?)",
        )
        .run(now(), now()),
    ).toThrow(/CHECK constraint failed/);
  });

  it('создаёт gift_links и не содержит колонку url у gifts', () => {
    const db = getDb();
    expect(tableColumns(db, 'gift_links')).toEqual([
      'id',
      'gift_id',
      'url',
      'sort_order',
      'created_at',
    ]);
    expect(tableColumns(db, 'gifts')).not.toContain('url');

    const index = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'gift_links_gift_id_idx'")
      .get();
    expect(index).toBeDefined();
  });

  it('категории привязаны к вишлисту, а не к владельцу', () => {
    const db = getDb();
    expect(tableColumns(db, 'categories')).toEqual([
      'id',
      'wishlist_id',
      'name',
      'created_at',
      'color',
    ]);
    expect(tableColumns(db, 'gift_categories')).toEqual(['gift_id', 'category_id']);

    const index = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'categories_wishlist_id_idx'")
      .get();
    expect(index).toBeDefined();
  });

  it('миграция 002 переносит старые ссылки и сохраняет данные', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(migrationSql('001_init.sql'));

    const timestamp = now();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO wishlists (id, owner_id, title, share_token, created_at, updated_at) VALUES ('w1', 'u1', 'Список', 'token-1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO gifts (id, wishlist_id, title, url, created_at, updated_at) VALUES ('g1', 'w1', 'Со ссылкой', 'https://example.com/g1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO gifts (id, wishlist_id, title, url, created_at, updated_at) VALUES ('g2', 'w1', 'Без ссылки', NULL, ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO bookings (id, gift_id, customer_name, customer_email, customer_email_norm, created_at) VALUES ('b1', 'g1', 'Гость', 'g@example.com', 'g@example.com', ?)",
    ).run(timestamp);

    db.exec(migrationSql('002_gift_links.sql'));

    expect(tableColumns(db, 'gifts')).not.toContain('url');
    const links = db
      .prepare('SELECT gift_id, url, sort_order FROM gift_links ORDER BY gift_id')
      .all() as Array<{ gift_id: string; url: string; sort_order: number }>;
    expect(links).toEqual([{ gift_id: 'g1', url: 'https://example.com/g1', sort_order: 0 }]);

    // Остальные данные не пострадали.
    expect(db.prepare('SELECT COUNT(*) AS count FROM gifts').get()).toEqual({ count: 2 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM bookings').get()).toEqual({ count: 1 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM wishlists').get()).toEqual({ count: 1 });
    db.close();
  });

  it('миграция 003 пересоздаёт категории в рамках вишлиста', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(migrationSql('001_init.sql'));
    db.exec(migrationSql('002_gift_links.sql'));
    db.exec(migrationSql('003_categories_scope.sql'));

    expect(tableColumns(db, 'categories')).toEqual(['id', 'wishlist_id', 'name', 'created_at']);
    expect(tableColumns(db, 'gift_categories')).toEqual(['gift_id', 'category_id']);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'categories_wishlist_id_idx'",
        )
        .get(),
    ).toBeDefined();

    const timestamp = now();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO wishlists (id, owner_id, title, share_token, created_at, updated_at) VALUES ('w1', 'u1', 'Первый', 'token-1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO wishlists (id, owner_id, title, share_token, created_at, updated_at) VALUES ('w2', 'u1', 'Второй', 'token-2', ?, ?)",
    ).run(timestamp, timestamp);

    const insertCategory = db.prepare(
      'INSERT INTO categories (id, wishlist_id, name, created_at) VALUES (?, ?, ?, ?)',
    );
    insertCategory.run('c1', 'w1', 'Книги', timestamp);
    // Уникальность — в рамках списка; в другом списке то же имя допустимо.
    expect(() => insertCategory.run('c2', 'w1', 'Книги', timestamp)).toThrow(
      /UNIQUE constraint failed/,
    );
    expect(() => insertCategory.run('c3', 'w2', 'Книги', timestamp)).not.toThrow();
    db.close();
  });

  it('миграция 004 добавляет nullable-цвет категориям', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(migrationSql('001_init.sql'));
    db.exec(migrationSql('002_gift_links.sql'));
    db.exec(migrationSql('003_categories_scope.sql'));

    const timestamp = now();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(timestamp, timestamp);
    db.prepare(
      "INSERT INTO wishlists (id, owner_id, title, share_token, created_at, updated_at) VALUES ('w1', 'u1', 'Список', 'token-1', ?, ?)",
    ).run(timestamp, timestamp);
    // Категория, созданная до миграции 004 (без color).
    db.prepare(
      "INSERT INTO categories (id, wishlist_id, name, created_at) VALUES ('c1', 'w1', 'Старая', ?)",
    ).run(timestamp);

    db.exec(migrationSql('004_category_color.sql'));

    expect(tableColumns(db, 'categories')).toEqual([
      'id',
      'wishlist_id',
      'name',
      'created_at',
      'color',
    ]);
    // Старые категории получают NULL («цвет по умолчанию»).
    expect(db.prepare('SELECT color FROM categories WHERE id = ?').get('c1')).toEqual({
      color: null,
    });
    // Новые значения цвета сохраняются.
    db.prepare(
      "INSERT INTO categories (id, wishlist_id, name, color, created_at) VALUES ('c2', 'w1', 'Новая', '#5A7BA6', ?)",
    ).run(timestamp);
    expect(db.prepare('SELECT color FROM categories WHERE id = ?').get('c2')).toEqual({
      color: '#5A7BA6',
    });
    db.close();
  });
});

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

const BEFORE_008 = [
  '001_init.sql',
  '002_gift_links.sql',
  '003_categories_scope.sql',
  '004_category_color.sql',
  '005_category_color_muted.sql',
  '006_wishlist_theme.sql',
  '007_wishlist_emoji.sql',
] as const;

/** Старая палитра → новая, позиция в списке сохраняется. */
const PALETTE_MAP: ReadonlyArray<readonly [old: string, next: string]> = [
  ['#A9544C', '#C4574D'],
  ['#B36A42', '#C57A44'],
  ['#A98A45', '#C0A24C'],
  ['#4F7A5B', '#6E9B78'],
  ['#47787A', '#4F8C86'],
  ['#4C6B92', '#5A7BA6'],
  ['#6B5A8E', '#8A7BB2'],
  ['#9A5F7C', '#B36B88'],
];

describe('миграция 008 (новая палитра оформления)', () => {
  it('применена к живой схеме', () => {
    expect(appliedMigrationNames(getDb())).toContain('008_muted_palette.sql');
  });

  it('перекрашивает старые цвета категорий и тем, не трогая NULL и чужие цвета', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const name of BEFORE_008) {
      db.exec(migrationSql(name));
    }

    const timestamp = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(timestamp, timestamp);
    const insertWishlist = db.prepare(
      `INSERT INTO wishlists (id, owner_id, title, share_token, theme_color, created_at, updated_at)
       VALUES (?, 'u1', ?, ?, ?, ?, ?)`,
    );
    insertWishlist.run('w-old', 'Старый пресет', 'token-1', PALETTE_MAP[0]![0], timestamp, timestamp);
    insertWishlist.run('w-old-2', 'Последний пресет', 'token-2', PALETTE_MAP[7]![0], timestamp, timestamp);
    insertWishlist.run('w-custom', 'Свой цвет', 'token-3', '#123456', timestamp, timestamp);
    insertWishlist.run('w-null', 'Без темы', 'token-4', null, timestamp, timestamp);

    const insertCategory = db.prepare(
      'INSERT INTO categories (id, wishlist_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    PALETTE_MAP.forEach(([old], index) => {
      insertCategory.run(`c-old-${index}`, 'w-old', `Старая ${index}`, old, timestamp);
    });
    insertCategory.run('c-null', 'w-old', 'Без цвета', null, timestamp);
    insertCategory.run('c-custom', 'w-old', 'Свой цвет', '#123456', timestamp);

    db.exec(migrationSql('008_muted_palette.sql'));

    // Категории: старые пресеты перекрашены, NULL и неизвестный цвет не тронуты.
    const categoryColors = db
      .prepare("SELECT color FROM categories WHERE id LIKE 'c-old-%' ORDER BY id")
      .all() as Array<{ color: string }>;
    expect(categoryColors.map((row) => row.color)).toEqual(PALETTE_MAP.map(([, next]) => next));
    expect(db.prepare('SELECT color FROM categories WHERE id = ?').get('c-null')).toEqual({
      color: null,
    });
    expect(db.prepare('SELECT color FROM categories WHERE id = ?').get('c-custom')).toEqual({
      color: '#123456',
    });

    // Темы вишлистов: старые пресеты перекрашены, свой цвет и NULL не тронуты.
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-old')).toEqual({
      theme_color: PALETTE_MAP[0]![1],
    });
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-old-2')).toEqual({
      theme_color: PALETTE_MAP[7]![1],
    });
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-custom')).toEqual({
      theme_color: '#123456',
    });
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-null')).toEqual({
      theme_color: null,
    });

    // Данные и связи на месте: вишлисты и их категории не потеряны.
    expect(db.prepare('SELECT COUNT(*) AS count FROM wishlists').get()).toEqual({ count: 4 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM categories').get()).toEqual({ count: 10 });
    expect(db.prepare('SELECT name FROM categories WHERE id = ?').get('c-old-0')).toEqual({
      name: 'Старая 0',
    });
    db.close();
  });
});

const BEFORE_010 = [...BEFORE_008, '008_muted_palette.sql', '009_password_resets.sql'] as const;

/** Приглушённая палитра → пастельная, позиция в списке сохраняется. */
const PASTEL_PALETTE_MAP: ReadonlyArray<readonly [old: string, next: string]> = [
  ['#C4574D', '#E0776A'],
  ['#C57A44', '#EE9B63'],
  ['#C0A24C', '#E8C466'],
  ['#6E9B78', '#7FC290'],
  ['#4F8C86', '#64BDB2'],
  ['#5A7BA6', '#7FAFE2'],
  ['#8A7BB2', '#A78FDE'],
  ['#B36B88', '#E28FAF'],
];

describe('миграция 010 (пастельная палитра оформления)', () => {
  it('применена к живой схеме', () => {
    expect(appliedMigrationNames(getDb())).toContain('010_pastel_palette.sql');
  });

  it('перекрашивает старые цвета категорий и тем, не трогая NULL и чужие цвета', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const name of BEFORE_010) {
      db.exec(migrationSql(name));
    }

    const timestamp = new Date().toISOString();
    db.prepare(
      "INSERT INTO users (id, email, username, display_name, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'u1user', 'U1', ?, ?)",
    ).run(timestamp, timestamp);
    const insertWishlist = db.prepare(
      `INSERT INTO wishlists (id, owner_id, title, share_token, theme_color, created_at, updated_at)
       VALUES (?, 'u1', ?, ?, ?, ?, ?)`,
    );
    insertWishlist.run('w-old', 'Старый пресет', 'token-1', PASTEL_PALETTE_MAP[0]![0], timestamp, timestamp);
    insertWishlist.run('w-old-2', 'Последний пресет', 'token-2', PASTEL_PALETTE_MAP[7]![0], timestamp, timestamp);
    insertWishlist.run('w-custom', 'Свой цвет', 'token-3', '#123456', timestamp, timestamp);
    insertWishlist.run('w-null', 'Без темы', 'token-4', null, timestamp, timestamp);

    const insertCategory = db.prepare(
      'INSERT INTO categories (id, wishlist_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    PASTEL_PALETTE_MAP.forEach(([old], index) => {
      insertCategory.run(`c-old-${index}`, 'w-old', `Старая ${index}`, old, timestamp);
    });
    insertCategory.run('c-null', 'w-old', 'Без цвета', null, timestamp);
    insertCategory.run('c-custom', 'w-old', 'Свой цвет', '#123456', timestamp);

    db.exec(migrationSql('010_pastel_palette.sql'));

    // Категории: старые пресеты перекрашены, NULL и неизвестный цвет не тронуты.
    const categoryColors = db
      .prepare("SELECT color FROM categories WHERE id LIKE 'c-old-%' ORDER BY id")
      .all() as Array<{ color: string }>;
    expect(categoryColors.map((row) => row.color)).toEqual(
      PASTEL_PALETTE_MAP.map(([, next]) => next),
    );
    expect(db.prepare('SELECT color FROM categories WHERE id = ?').get('c-null')).toEqual({
      color: null,
    });
    expect(db.prepare('SELECT color FROM categories WHERE id = ?').get('c-custom')).toEqual({
      color: '#123456',
    });

    // Темы вишлистов: старые пресеты перекрашены, свой цвет и NULL не тронуты.
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-old')).toEqual({
      theme_color: PASTEL_PALETTE_MAP[0]![1],
    });
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-old-2')).toEqual({
      theme_color: PASTEL_PALETTE_MAP[7]![1],
    });
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-custom')).toEqual({
      theme_color: '#123456',
    });
    expect(db.prepare('SELECT theme_color FROM wishlists WHERE id = ?').get('w-null')).toEqual({
      theme_color: null,
    });

    // Данные и связи на месте: вишлисты и их категории не потеряны.
    expect(db.prepare('SELECT COUNT(*) AS count FROM wishlists').get()).toEqual({ count: 4 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM categories').get()).toEqual({ count: 10 });
    expect(db.prepare('SELECT name FROM categories WHERE id = ?').get('c-old-0')).toEqual({
      name: 'Старая 0',
    });
    db.close();
  });
});

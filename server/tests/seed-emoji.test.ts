import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/index.ts';
import { seed } from '../src/db/seed.ts';
import { resetAll } from './helpers.ts';

beforeEach(() => {
  resetAll();
});

describe('seed: эмодзи-оформление вишлистов', () => {
  it('проставляет эмодзи одному-двум вишлистам', async () => {
    const seeded = await seed();
    expect(seeded).toBe(true);

    const rows = getDb()
      .prepare('SELECT title, theme_emoji FROM wishlists ORDER BY sort_order, title')
      .all() as Array<{ title: string; theme_emoji: string | null }>;
    const withEmoji = rows.filter((row) => row.theme_emoji !== null);

    expect(withEmoji.length).toBeGreaterThanOrEqual(1);
    expect(withEmoji.length).toBeLessThanOrEqual(2);
    expect(withEmoji.map((row) => row.theme_emoji).sort()).toEqual(['🎁', '📚'].sort());
    // Остальные вишлисты — без эмодзи (NULL, а не пустая строка).
    expect(rows.filter((row) => row.theme_emoji === null).length).toBe(rows.length - withEmoji.length);
  });
});

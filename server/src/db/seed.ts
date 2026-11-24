import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { getDb, closeDb } from './index.ts';
import { logger } from '../logger.ts';

const NOW = () => new Date().toISOString();
const ID = () => randomUUID();

/**
 * Тестовые данные: 2 пользователя, 3 вишлиста, 8 подарков, 1 активная бронь.
 * Пароль у обоих пользователей: test12345
 * Скрипт идемпотентен: если пользователи уже есть, ничего не меняет.
 */
export async function seed(): Promise<boolean> {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (existing.count > 0) {
    logger.info('Тестовые данные уже есть — пропускаю (удалите server/data/app.db, чтобы начать заново).');
    return false;
  }

  const passwordHash = await hash('test12345', { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const now = NOW();

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, email_verified_at, password_hash, username, display_name,
                       bio, birth_month, birth_day, birth_year, show_birth_year, timezone,
                       is_profile_public, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSettings = db.prepare(`
    INSERT INTO user_settings (user_id) VALUES (?)
  `);

  const annaId = ID();
  const borisId = ID();
  const veraId = ID();
  const wishlistBirthday = ID();
  const wishlistBooks = ID();
  const wishlistIdeas = ID();
  const wishlistNewYear = ID();

  // Категории принадлежат вишлисту (см. categories.wishlist_id).
  const categoryElectronics = ID();
  const categoryCozy = ID();
  const categoryClassic = ID();
  const categoryModernProse = ID();

  const seedAll = db.transaction(() => {
    insertUser.run(
      annaId, 'anna@example.com', now, passwordHash, 'anna', 'Анна Петрова',
      'Люблю книги и уютные вещи.', 4, 15, 1992, 1, 'Europe/Moscow', 1, now, now,
    );
    insertUser.run(
      borisId, 'boris@example.com', now, passwordHash, 'boris', 'Борис Иванов',
      'Кофе, музыка и всякие полезные штуки.', 1, 3, null, 0, 'Europe/Moscow', 1, now, now,
    );
    insertUser.run(
      veraId, 'vera@example.com', now, passwordHash, 'vera', 'Вера Соколова',
      'Цветы, керамика и долгие прогулки.', 7, 8, 1995, 0, 'Europe/Moscow', 1, now, now,
    );
    insertSettings.run(annaId);
    insertSettings.run(borisId);
    insertSettings.run(veraId);

    // Подписки (этап 3): у Анны два подписчика, сама она подписана на Веру.
    const insertFollow = db.prepare(
      'INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)',
    );
    insertFollow.run(ID(), borisId, annaId, now);
    insertFollow.run(ID(), veraId, annaId, now);
    insertFollow.run(ID(), annaId, veraId, now);

    const insertWishlist = db.prepare(`
      INSERT INTO wishlists (id, owner_id, title, description, event_date, visibility, share_token,
                             sort_order, show_booked, show_booker_names, theme_color, theme_emoji,
                             created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertWishlist.run(
      wishlistBirthday, annaId, 'День рождения',
      'Буду рада любому из списка — приятно, что вы вообще зашли.',
      '2026-12-20', 'link', 'annaBD2', 0, 0, 0, '#C4574D', '🎁', now, now,
    );
    insertWishlist.run(
      wishlistBooks, annaId, 'Книги',
      'Список для пополнения библиотеки.', null, 'link', 'annaBK3', 1, 0, 0, '#5A7BA6', '📚', now, now,
    );
    insertWishlist.run(
      wishlistIdeas, annaId, 'Просто мои желания',
      'То, что пригодилось бы в быту.', null, 'followers', 'annaWS4', 2, 0, 0, '#8A7BB2', null, now, now,
    );
    insertWishlist.run(
      wishlistNewYear, borisId, 'Новый год',
      'Подарки к празднику.', '2027-01-01', 'link', 'borisNY', 0, 0, 0, '#6E9B78', null, now, now,
    );

    const insertCategory = db.prepare(
      'INSERT INTO categories (id, wishlist_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    insertCategory.run(categoryElectronics, wishlistBirthday, 'Электроника', '#5A7BA6', now);
    insertCategory.run(categoryCozy, wishlistBirthday, 'Уют', '#6E9B78', now);
    insertCategory.run(categoryClassic, wishlistBooks, 'Классика', '#C0A24C', now);
    insertCategory.run(categoryModernProse, wishlistBooks, 'Современная проза', '#8A7BB2', now);

    const insertGift = db.prepare(`
      INSERT INTO gifts (id, wishlist_id, title, description, price_minor, currency, priority,
                         status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)
    `);
    const insertGiftLink = db.prepare(`
      INSERT INTO gift_links (id, gift_id, url, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    // [вишлист, название, описание, ссылки (0–10), цена в копейках, приоритет]
    const gifts = [
      [wishlistBirthday, 'Наушники Sony WH-1000XM5', 'Для работы и прогулок, шумоподавление.', ['https://example.com/sony', 'https://example.com/sony-deal'], 2999000, 1],
      [wishlistBirthday, 'Сертификат в книжный магазин', 'Лучше номиналом 2000 ₽.', [], 200000, 2],
      [wishlistBirthday, 'Пушистый плед', 'Тёплый, нейтрального цвета.', ['https://example.com/plaid'], 350000, 2],
      [wishlistBooks, '«Сто лет одиночества»', 'Издание с хорошей бумагой.', ['https://example.com/book1'], 120000, 2],
      [wishlistBooks, '«Дом, в котором…»', 'Давно хотела перечитать.', [], 90000, 3],
      [wishlistIdeas, 'Керамическая кружка', 'Простая, без рисунков.', [], 70000, 4],
      [wishlistIdeas, 'Ночник с тёплым светом', 'С регулировкой яркости.', [], 150000, 3],
      [wishlistNewYear, 'Кофемолка', 'Ручная или электрическая.', ['https://example.com/coffee'], 450000, 2],
    ] as const;

    const giftIds: string[] = [];
    gifts.forEach((gift, index) => {
      const giftId = ID();
      giftIds.push(giftId);
      insertGift.run(giftId, gift[0], gift[1], gift[2], gift[4], 'RUB', gift[5], index, now, now);
      gift[3].forEach((url, linkIndex) => {
        insertGiftLink.run(ID(), giftId, url, linkIndex, now);
      });
    });

    const linkCategory = db.prepare('INSERT INTO gift_categories (gift_id, category_id) VALUES (?, ?)');
    // Наушники — подарок с двумя ссылками, тоже с тегом.
    linkCategory.run(giftIds[0]!, categoryElectronics);
    linkCategory.run(giftIds[2]!, categoryCozy);
    // «Сто лет одиночества» — сразу два тега, чтобы было видно набор.
    linkCategory.run(giftIds[3]!, categoryClassic);
    linkCategory.run(giftIds[3]!, categoryModernProse);
    linkCategory.run(giftIds[4]!, categoryModernProse);

    // Одна активная бронь — чтобы было что проверять вручную.
    const bookedGiftId = giftIds[1]!;
    db.prepare(`
      INSERT INTO bookings (id, gift_id, customer_name, customer_email, customer_email_norm, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ID(), bookedGiftId, 'Мария', 'maria@example.com', 'maria@example.com', now);
  });

  seedAll();

  logger.info('Тестовые данные созданы.');
  logger.info(
    'Пользователи: anna@example.com / boris@example.com / vera@example.com, пароль: test12345',
  );
  logger.info('Вишлисты: «День рождения», «Книги», «Просто мои желания», «Новый год».');
  logger.info('Подписки: boris и vera подписаны на anna, anna — на vera.');
  return true;
}

// Прямой запуск: npm run db:seed
const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    await seed();
    closeDb();
    process.exit(0);
  } catch (error) {
    logger.error('Не удалось создать тестовые данные', error);
    closeDb();
    process.exit(1);
  }
}

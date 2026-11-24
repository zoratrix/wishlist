-- 003_categories_scope.sql — категории (теги) принадлежат вишлисту, а не владельцу.
--
-- Было (001_init.sql): categories.owner_id + UNIQUE(owner_id, name); одна
-- категория могла использоваться подарками из любых списков владельца.
-- Стало: категория живёт в рамках одного вишлиста (categories.wishlist_id),
-- название уникально внутри списка. Удаление списка каскадно удаляет его
-- категории и связи; удаление категории снимает тег с подарков.
--
-- ПОЧЕМУ ДАННЫЕ ПЕРЕСОЗДАЮТСЯ: публичного API категорий до этой задачи не
-- существовало (ни эндпоинтов, ни UI); строки появлялись только из сида
-- (`npm run db:seed`) и тестовых прогонов. Переносить их нечем и незачем:
-- область видимости меняется принципиально, а имена/владельцы в старых
-- записях не привязаны к вишлисту. Поэтому обе таблицы пересоздаются, а
-- пользовательские данные (пользователи, вишлисты, подарки, брони, ссылки)
-- не затрагиваются.
--
-- SQLite DDL транзакционен; раннер применяет файл целиком в одной транзакции.

DROP TABLE gift_categories;
DROP TABLE categories;

CREATE TABLE categories (
  id          TEXT PRIMARY KEY NOT NULL,
  wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (wishlist_id, name)
);

CREATE INDEX categories_wishlist_id_idx ON categories(wishlist_id);

CREATE TABLE gift_categories (
  gift_id     TEXT NOT NULL REFERENCES gifts(id)    ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (gift_id, category_id)
);

CREATE INDEX gift_categories_category_id_idx ON gift_categories(category_id);

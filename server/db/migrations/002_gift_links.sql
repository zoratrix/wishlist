-- 002_gift_links.sql — у подарка может быть несколько ссылок на товар.
--
-- Было: gifts.url (одна ссылка). Стало: таблица gift_links (0–10 ссылок,
-- порядок пользователя). Старые значения переносим, затем колонку удаляем.
--
-- SQLite (better-sqlite3 13, SQLite >= 3.35) поддерживает ALTER TABLE DROP
-- COLUMN, поэтому официальный паттерн «новая таблица → перенос → переименование»
-- не нужен: gift_links — независимая таблица, а url в gifts не индексирован
-- и ничем не используется, так что удаление безопасно и выполняется в той же
-- транзакции, что и миграция (раннер применяет файл целиком).

CREATE TABLE gift_links (
  id         TEXT    PRIMARY KEY NOT NULL,
  gift_id    TEXT    NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  url        TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE INDEX gift_links_gift_id_idx ON gift_links(gift_id, sort_order);

-- Бэкфилл: существующий url становится единственной ссылкой подарка.
-- id детерминированный ('link-' + id подарка), чтобы миграция была
-- предсказуемой; повторного запуска не будет (schema_migrations).
INSERT INTO gift_links (id, gift_id, url, sort_order, created_at)
SELECT 'link-' || id, id, url, 0, created_at
  FROM gifts
 WHERE url IS NOT NULL AND url <> '';

ALTER TABLE gifts DROP COLUMN url;

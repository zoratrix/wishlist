-- 006_wishlist_theme.sql — необязательный цвет-тема вишлиста.
--
-- theme_color TEXT NULL: NULL — «цвет по умолчанию». Палитра из 8 приглушённых
-- цветов (та же, что у категорий) проверяется сервисом, а не CHECK в БД: так
-- список можно расширять без миграции, а invalid-цвет возвращает 400
-- INVALID_COLOR. Существующие вишлисты автоматически получают NULL.

ALTER TABLE wishlists ADD COLUMN theme_color TEXT;

-- 001_init.sql — начальная схема платформы вишлистов.
-- Идентификаторы — UUID (генерируются приложением, нельзя угадать по номеру).
-- Время — ISO 8601 UTC в TEXT (сортируется как строка, читается глазами).
-- Булевы значения — INTEGER 0/1 (как принято в SQLite).

-- ============================================================
-- Пользователи и авторизация
-- ============================================================

CREATE TABLE users (
  id                TEXT    PRIMARY KEY NOT NULL,
  email             TEXT    NOT NULL UNIQUE,          -- нормализованный: trim + lower
  email_verified_at TEXT,
  password_hash     TEXT,                             -- Argon2id; NULL = только Яндекс ID
  username          TEXT    NOT NULL UNIQUE,          -- a-z0-9_, ссылка /u/username
  display_name      TEXT    NOT NULL,
  avatar_path       TEXT,
  bio               TEXT,
  birth_month       INTEGER,                          -- 1..12, необязательно
  birth_day         INTEGER,                          -- 1..31, необязательно
  birth_year        INTEGER,                          -- необязательно
  show_birth_year   INTEGER NOT NULL DEFAULT 0,       -- показывать год в профиле
  timezone          TEXT    NOT NULL DEFAULT 'Europe/Moscow',
  is_profile_public INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  CHECK (birth_month IS NULL OR (birth_month BETWEEN 1 AND 12)),
  CHECK (birth_day   IS NULL OR (birth_day   BETWEEN 1 AND 31)),
  CHECK (birth_year  IS NULL OR (birth_year  BETWEEN 1900 AND 2100)),
  CHECK (show_birth_year   IN (0, 1)),
  CHECK (is_profile_public IN (0, 1)),
  CHECK (birth_year IS NULL OR (birth_month IS NOT NULL AND birth_day IS NOT NULL))
);

CREATE TABLE oauth_accounts (
  id                TEXT PRIMARY KEY NOT NULL,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,                    -- 'yandex'
  provider_user_id  TEXT NOT NULL,
  email_at_provider TEXT,
  created_at        TEXT NOT NULL,
  UNIQUE (provider, provider_user_id),
  UNIQUE (user_id, provider),
  CHECK (provider IN ('yandex'))
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,                  -- SHA-256 от токена из cookie
  csrf_token   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  ip_hash      TEXT,
  user_agent   TEXT
);

CREATE INDEX sessions_user_id_idx    ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE email_tokens (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  new_email  TEXT,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL,
  CHECK (type IN ('verify_email', 'reset_password', 'change_email'))
);

CREATE INDEX email_tokens_user_id_idx ON email_tokens(user_id);

CREATE TABLE user_settings (
  user_id                TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled          INTEGER NOT NULL DEFAULT 1,  -- мастер-выключатель писем
  email_birthday         INTEGER NOT NULL DEFAULT 1,
  email_new_follower     INTEGER NOT NULL DEFAULT 1,
  in_app_birthday        INTEGER NOT NULL DEFAULT 1,
  in_app_new_follower    INTEGER NOT NULL DEFAULT 1,
  CHECK (email_enabled       IN (0, 1)),
  CHECK (email_birthday      IN (0, 1)),
  CHECK (email_new_follower  IN (0, 1)),
  CHECK (in_app_birthday     IN (0, 1)),
  CHECK (in_app_new_follower IN (0, 1))
);

-- ============================================================
-- Социальные связи
-- ============================================================

CREATE TABLE follows (
  id           TEXT PRIMARY KEY NOT NULL,
  follower_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX follows_following_id_idx ON follows(following_id);

-- ============================================================
-- Вишлисты и подарки
-- ============================================================

CREATE TABLE wishlists (
  id                TEXT PRIMARY KEY NOT NULL,
  owner_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  cover_path        TEXT,
  event_date        TEXT,                             -- YYYY-MM-DD
  visibility        TEXT NOT NULL DEFAULT 'public',
  share_token       TEXT NOT NULL UNIQUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  show_booked       INTEGER NOT NULL DEFAULT 0,       -- по умолчанию владелец НЕ видит брони
  show_booker_names INTEGER NOT NULL DEFAULT 0,       -- действует только при show_booked = 1
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (visibility IN ('public', 'link', 'followers')),
  CHECK (show_booked       IN (0, 1)),
  CHECK (show_booker_names IN (0, 1)),
  CHECK (show_booker_names = 0 OR show_booked = 1)
);

CREATE INDEX wishlists_owner_id_idx ON wishlists(owner_id, sort_order);

CREATE TABLE gifts (
  id          TEXT PRIMARY KEY NOT NULL,
  wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  url         TEXT,
  image_url   TEXT,
  image_path  TEXT,
  price_minor INTEGER,                                -- в копейках
  currency    TEXT NOT NULL DEFAULT 'RUB',
  priority    INTEGER NOT NULL DEFAULT 3,             -- 1 — очень нужен … 5 — когда-нибудь
  status      TEXT NOT NULL DEFAULT 'available',      -- 'booked' вычисляется по брони
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  CHECK (priority BETWEEN 1 AND 5),
  CHECK (status IN ('available', 'gifted')),
  CHECK (price_minor IS NULL OR price_minor >= 0)
);

CREATE INDEX gifts_wishlist_id_idx ON gifts(wishlist_id, sort_order);
CREATE INDEX gifts_status_idx      ON gifts(status);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY NOT NULL,
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, name)
);

CREATE TABLE gift_categories (
  gift_id     TEXT NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (gift_id, category_id)
);

CREATE INDEX gift_categories_category_id_idx ON gift_categories(category_id);

-- ============================================================
-- Бронирование (главная особенность платформы)
-- ============================================================

CREATE TABLE bookings (
  id                  TEXT PRIMARY KEY NOT NULL,
  gift_id             TEXT NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,                  -- как ввёл посетитель
  customer_email_norm TEXT NOT NULL,                  -- только для сравнения при отмене
  created_at          TEXT NOT NULL,
  cancelled_at        TEXT,                           -- NULL = бронь активна
  cancelled_reason    TEXT,
  CHECK (cancelled_reason IS NULL OR cancelled_reason IN ('visitor', 'owner_gifted', 'gift_deleted'))
);

CREATE INDEX bookings_gift_id_idx    ON bookings(gift_id);
CREATE INDEX bookings_email_norm_idx ON bookings(customer_email_norm);

-- ГЛАВНЫЙ ИНВАРИАНТ: у подарка не может быть двух активных броней.
-- Уникальный частичный индекс — гарантия на уровне базы, а не только кода.
CREATE UNIQUE INDEX bookings_one_active_per_gift
  ON bookings(gift_id)
  WHERE cancelled_at IS NULL;

CREATE TABLE booking_attempts (
  id         TEXT PRIMARY KEY NOT NULL,
  gift_id    TEXT NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  ip_hash    TEXT NOT NULL,
  email_hash TEXT,
  action     TEXT NOT NULL,
  success    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (action  IN ('book', 'unbook')),
  CHECK (success IN (0, 1))
);

CREATE INDEX booking_attempts_gift_idx ON booking_attempts(gift_id, created_at);
CREATE INDEX booking_attempts_ip_idx   ON booking_attempts(ip_hash, created_at);

-- ============================================================
-- Уведомления и почта
-- ============================================================

CREATE TABLE notifications (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  payload_json TEXT,
  dedupe_key   TEXT NOT NULL UNIQUE,                  -- защита от повторных уведомлений
  created_at   TEXT NOT NULL,
  read_at      TEXT,
  CHECK (type IN ('new_follower', 'birthday_1month', 'birthday_2weeks', 'system'))
);

CREATE INDEX notifications_user_id_idx ON notifications(user_id, created_at DESC);

CREATE TABLE email_outbox (
  id         TEXT PRIMARY KEY NOT NULL,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  body_text  TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,                    -- защита от повторной отправки
  status     TEXT NOT NULL DEFAULT 'pending',
  attempts   INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  not_before TEXT NOT NULL,
  sent_at    TEXT,
  created_at TEXT NOT NULL,
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'))
);

CREATE INDEX email_outbox_status_idx ON email_outbox(status, not_before);

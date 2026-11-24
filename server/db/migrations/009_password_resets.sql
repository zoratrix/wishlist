-- 009_password_resets.sql — восстановление пароля по email.
-- Одноразовые ссылки: в БД лежит только SHA-256 от токена из письма, поэтому
-- утечка базы не даёт возможности сбросить чужой пароль. `used_at` помечает
-- использованную (и инвалидированную) ссылку; просроченные строки можно
-- безопасно удалять по `expires_at`.

CREATE TABLE password_resets (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,                    -- SHA-256 от токена из письма
  expires_at TEXT NOT NULL,                           -- ISO 8601 UTC, срок 1 час
  used_at    TEXT,                                    -- NULL = ссылка ещё не использована
  created_at TEXT NOT NULL
);

CREATE INDEX password_resets_user_id_idx    ON password_resets(user_id);
CREATE INDEX password_resets_expires_at_idx ON password_resets(expires_at);

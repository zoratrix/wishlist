import { config } from '../../config.ts';
import { getDb } from '../../db/index.ts';
import { AppError } from '../../errors.ts';
import { newId, normalizeEmail, randomToken, sha256Hex } from '../../lib/crypto.ts';
import { isSmtpConfigured } from '../../lib/mailer.ts';
import type { PasswordResetRow } from '../../lib/rows.ts';
import { hashPassword } from './auth.service.ts';

/** Срок жизни ссылки — 1 час. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Одинаковый текст для несуществующего, просроченного и уже использованного
 * токена: по ответу нельзя понять, какая именно причина.
 */
const INVALID_TOKEN_MESSAGE = 'Ссылка для восстановления пароля недействительна или устарела.';

function invalidTokenError(): AppError {
  return new AppError(400, 'INVALID_RESET_TOKEN', INVALID_TOKEN_MESSAGE);
}

/** Ссылка из письма: ${APP_ORIGIN}/reset-password?token=... */
export function buildPasswordResetUrl(token: string): string {
  return `${config.APP_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Возвращать ли ссылку прямо в ответе API. Только вне production и только
 * когда почта не настроена — чтобы локально пройти сценарий без SMTP.
 */
export function shouldExposeDebugUrl(): boolean {
  return config.env !== 'production' && !isSmtpConfigured();
}

export interface CreatedPasswordReset {
  userId: string;
  token: string;
}

/**
 * Создаёт одноразовый токен для существующего email. Для неизвестного email
 * возвращает null: токен не создаётся, но API отвечает так же.
 * Все прежние неиспользованные ссылки пользователя инвалидируются.
 */
export function createPasswordResetToken(email: string): CreatedPasswordReset | null {
  const db = getDb();
  const user = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(normalizeEmail(email)) as { id: string } | undefined;
  if (user === undefined) return null;

  const token = randomToken(32);
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString();

  db.transaction(() => {
    db.prepare(
      'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
    ).run(createdAt, user.id);
    db.prepare(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    ).run(newId(), user.id, sha256Hex(token), expiresAt, createdAt);
  })();

  return { userId: user.id, token };
}

/**
 * Меняет пароль по одноразовому токену: помечает ссылку использованной,
 * обновляет `password_hash` и удаляет ВСЕ сессии пользователя (выход со всех
 * устройств). Всё одной транзакцией.
 */
export function resetPasswordWithToken(token: string, password: string): void {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM password_resets WHERE token_hash = ?')
    .get(sha256Hex(token)) as PasswordResetRow | undefined;

  if (row === undefined) throw invalidTokenError();
  if (row.used_at !== null) throw invalidTokenError();
  const expiresAtMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) throw invalidTokenError();

  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  db.transaction(() => {
    // Условный UPDATE закрывает гонку двух одновременных запросов одним токеном.
    const marked = db
      .prepare('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL')
      .run(now, row.id);
    if (marked.changes !== 1) throw invalidTokenError();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      now,
      row.user_id,
    );
    // Пароль сменился — все старые cookie должны перестать работать.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    // Любые другие невыпущенные/неиспользованные ссылки тоже сгорают.
    db.prepare(
      'UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
    ).run(now, row.user_id);
  })();
}

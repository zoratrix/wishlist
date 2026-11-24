import { hashSync, verifySync } from '@node-rs/argon2';
import type { Request } from 'express';
import { getDb } from '../../db/index.ts';
import { ConflictError } from '../../errors.ts';
import { isUniqueConstraintError, uniqueConstraintField } from '../../lib/db-errors.ts';
import { newId } from '../../lib/crypto.ts';
import type { SessionRow, UserRow } from '../../lib/rows.ts';
import { createSession } from '../../lib/session.ts';
import type { RegisterInput } from './auth.schemas.ts';

/**
 * Хеширование паролей. @node-rs/argon2 по умолчанию использует Argon2id
 * (m=19456, t=2, p=1) — явные параметры фиксируем, чтобы политика не менялась
 * при обновлении библиотеки. Ambient const enum `Algorithm` недоступен при
 * verbatimModuleSyntax, поэтому опираемся на документированное значение
 * по умолчанию.
 */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): string {
  return hashSync(password, ARGON2_OPTIONS);
}

export function verifyPassword(hash: string, password: string): boolean {
  try {
    return verifySync(hash, password);
  } catch {
    // Повреждённый хеш — вход невозможен, но это не должно ронять сервер.
    return false;
  }
}

export function findUserByEmail(email: string): UserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  return row ? (row as UserRow) : null;
}

function findUserIdByEmail(email: string): boolean {
  return getDb().prepare('SELECT 1 AS found FROM users WHERE email = ?').get(email) !== undefined;
}

function findUserIdByUsername(username: string): boolean {
  return getDb().prepare('SELECT 1 AS found FROM users WHERE username = ?').get(username) !== undefined;
}

export interface RegisterResult {
  user: UserRow;
  session: SessionRow;
  token: string;
}

/**
 * Регистрация: сразу создаёт сессию (вход без подтверждения email — этап 4).
 * Пользователь и настройки уведомлений пишутся одной транзакцией.
 */
export function registerUser(input: RegisterInput, req: Request): RegisterResult {
  const db = getDb();
  const email = input.email;
  const username = input.username;

  if (findUserIdByEmail(email)) {
    throw new ConflictError('EMAIL_TAKEN', 'Пользователь с таким email уже зарегистрирован.');
  }
  if (findUserIdByUsername(username)) {
    throw new ConflictError('USERNAME_TAKEN', 'Такой логин уже занят. Выберите другой.');
  }

  const userId = newId();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);
  const emailEnabled = input.emailNotifications === false ? 0 : 1;

  try {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, username, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(userId, email, passwordHash, username, input.displayName, now, now);
      db.prepare('INSERT INTO user_settings (user_id, email_enabled) VALUES (?, ?)').run(
        userId,
        emailEnabled,
      );
    })();
  } catch (error) {
    // Гонка между проверкой и вставкой: UNIQUE-индекс всё равно не даст дубль.
    if (isUniqueConstraintError(error)) {
      const field = uniqueConstraintField(error);
      if (field === 'users.email') {
        throw new ConflictError('EMAIL_TAKEN', 'Пользователь с таким email уже зарегистрирован.');
      }
      if (field === 'users.username') {
        throw new ConflictError('USERNAME_TAKEN', 'Такой логин уже занят. Выберите другой.');
      }
    }
    throw error;
  }

  const user = findUserByIdOrThrow(userId);
  const { session, token } = createSession(userId, req);
  return { user, session, token };
}

function findUserByIdOrThrow(userId: string): UserRow {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) throw new Error('Созданный пользователь не найден');
  return row as UserRow;
}

/** Проверка учётных данных. Одна и та же ошибка для «нет email» и «неверный пароль». */
export function authenticateUser(email: string, password: string): UserRow | null {
  const user = findUserByEmail(email);
  if (user === null || user.password_hash === null) return null;
  return verifyPassword(user.password_hash, password) ? user : null;
}

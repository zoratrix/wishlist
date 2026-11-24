import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { getDb } from '../db/index.ts';
import { AppError, UnauthorizedError } from '../errors.ts';
import { hashWithSecret, newId, randomToken, safeEqualText, sha256Hex } from './crypto.ts';
import { clientIp } from './http.ts';
import type { SessionRow, UserRow } from './rows.ts';

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'csrf';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Смотрящий: пользователь + его серверная сессия. */
export interface Viewer {
  user: UserRow;
  session: SessionRow;
}

function cookieBase(): {
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return { sameSite: 'lax', secure: config.isProd, path: '/', maxAge: SESSION_TTL_MS };
}

export function setSessionCookies(res: Response, session: SessionRow, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieBase(), httpOnly: true });
  res.cookie(CSRF_COOKIE, session.csrf_token, { ...cookieBase(), httpOnly: false });
}

export function setCsrfCookie(res: Response, session: SessionRow): void {
  res.cookie(CSRF_COOKIE, session.csrf_token, { ...cookieBase(), httpOnly: false });
}

export function clearSessionCookies(res: Response): void {
  const { sameSite, secure, path } = cookieBase();
  res.clearCookie(SESSION_COOKIE, { sameSite, secure, path, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { sameSite, secure, path, httpOnly: false });
}

function getCookie(req: Request, name: string): string | null {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Ищет активную сессию по токену из cookie (в БД — только sha256). */
function findSessionByToken(token: string): SessionRow | null {
  const row = getDb().prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256Hex(token));
  if (!row) return null;
  const session = row as SessionRow;
  if (Date.parse(session.expires_at) <= Date.now()) {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
    return null;
  }
  return session;
}

export function findUserById(userId: string): UserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return row ? (row as UserRow) : null;
}

/**
 * Создаёт новую сессию. В БД пишется лишь хеш токена: утечка базы не даёт
 * возможности войти по украденным значениям.
 */
export function createSession(userId: string, req: Request): { session: SessionRow; token: string } {
  const token = randomToken(32);
  const now = new Date();
  const session: SessionRow = {
    id: newId(),
    user_id: userId,
    token_hash: sha256Hex(token),
    csrf_token: randomToken(32),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    // В БД храним только хеш IP — открытый адрес не нужен.
    ip_hash: hashWithSecret(clientIp(req)),
    user_agent: req.get('user-agent')?.slice(0, 255) ?? null,
  };
  getDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, csrf_token, created_at, last_seen_at, expires_at, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      session.id,
      session.user_id,
      session.token_hash,
      session.csrf_token,
      session.created_at,
      session.last_seen_at,
      session.expires_at,
      session.ip_hash,
      session.user_agent,
    );
  return { session, token };
}

export function destroySession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/** Скользящее продление: обновляем метки не чаще раза в минуту. */
function touchSession(session: SessionRow): void {
  const now = new Date();
  const lastSeen = Date.parse(session.last_seen_at);
  if (Number.isFinite(lastSeen) && now.getTime() - lastSeen < 60_000) return;
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  getDb()
    .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
    .run(now.toISOString(), expiresAt, session.id);
  session.last_seen_at = now.toISOString();
  session.expires_at = expiresAt;
}

/**
 * Определяет смотрящего по cookie `sid` и кладёт его в `res.locals.viewer`.
 * Невалидная/просроченная сессия не считается входом — просто гость,
 * cookie при этом удаляются, чтобы браузер не присылал мусор.
 */
export function attachViewer(req: Request, res: Response, next: NextFunction): void {
  const token = getCookie(req, SESSION_COOKIE);
  if (token === null) {
    res.locals.viewer = null;
    next();
    return;
  }
  const session = findSessionByToken(token);
  const user = session ? findUserById(session.user_id) : null;
  if (session === null || user === null) {
    res.locals.viewer = null;
    clearSessionCookies(res);
    next();
    return;
  }
  touchSession(session);
  res.locals.viewer = { user, session } satisfies Viewer;
  next();
}

export function getViewer(res: Response): Viewer | null {
  const viewer = res.locals.viewer as Viewer | null | undefined;
  return viewer ?? null;
}

export function requireViewer(res: Response): Viewer {
  const viewer = getViewer(res);
  if (viewer === null) throw new UnauthorizedError('Нужно войти в аккаунт.');
  return viewer;
}

// Публичные POST без сессии: восстановление пароля работает и для авторизованных,
// поэтому проверка CSRF для них не имеет смысла (как у входа и регистрации).
const CSRF_EXEMPT_PATHS = new Set([
  '/auth/register',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
]);
const CSRF_EXEMPT_PUBLIC_BOOKING = /^\/w\/[^/]+\/gifts\/[^/]+\/(?:book|unbook)$/;

/**
 * CSRF: для авторизованных небезопасных запросов обязателен заголовок
 * `X-CSRF-Token`, равный `csrf_token` серверной сессии. Гостевые запросы
 * (регистрация, вход, бронирование и отмена) проверки не требуют.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  const viewer = getViewer(res);
  if (viewer === null) {
    next();
    return;
  }
  if (CSRF_EXEMPT_PATHS.has(req.path) || CSRF_EXEMPT_PUBLIC_BOOKING.test(req.path)) {
    next();
    return;
  }
  const header = req.get('x-csrf-token') ?? '';
  if (!safeEqualText(header, viewer.session.csrf_token)) {
    throw new AppError(
      403,
      'CSRF_FAILED',
      'Не удалось проверить безопасность запроса. Обновите страницу и попробуйте снова.',
    );
  }
  next();
}

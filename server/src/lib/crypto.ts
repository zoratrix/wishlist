import crypto from 'node:crypto';
import { config } from '../config.ts';

/** Нормализация email — единая для регистрации, входа, брони и отмены. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** SHA-256 в hex. */
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * SHA-256(значение + серверный секрет).
 * В `booking_attempts` и `sessions` не должно быть открытых email/IP.
 */
export function hashWithSecret(value: string): string {
  return sha256Hex(value + config.HASH_SECRET);
}

/** Сравнение hex-хешей за константное время. */
export function safeEqualHash(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Сравнение строк за константное время (CSRF-токен). */
export function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/** UUID v4 — идентификаторы нельзя угадать по номеру. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Случайный токен base64url (по умолчанию 32 байта = 256 бит). */
export function randomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

/** Длина короткой ссылки на вишлист: /w/<7 символов>. */
export const SHARE_TOKEN_LENGTH = 7;

/** Алфавит коротких ссылок — только [A-Za-z0-9] (без `-` и `_`, удобно в чате). */
const SHARE_TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Крипто-случайный shareToken: ровно SHARE_TOKEN_LENGTH символов [A-Za-z0-9].
 * Отбрасываем байты >= 248 (248 = 62·4), чтобы не было смещения по модулю.
 */
export function newShareToken(): string {
  let token = '';
  while (token.length < SHARE_TOKEN_LENGTH) {
    for (const byte of crypto.randomBytes(SHARE_TOKEN_LENGTH)) {
      if (token.length === SHARE_TOKEN_LENGTH) break;
      if (byte < 248) token += SHARE_TOKEN_ALPHABET[byte % SHARE_TOKEN_ALPHABET.length];
    }
  }
  return token;
}

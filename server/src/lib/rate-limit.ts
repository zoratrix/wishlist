import { TooManyRequestsError } from '../errors.ts';

/**
 * Лимиты частоты в памяти процесса: простое скользящее окно с Map.
 * Для MVP этого достаточно (один процесс, счётчик живёт до перезапуска);
 * лимиты отмены брони хранятся в БД (`booking_attempts`), потому что не должны
 * сбрасываться при перезапуске.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanupAt = Date.now();

/** Периодически выкидываем просроченные ключи, чтобы Map не разрастался. */
function cleanup(now: number): void {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/** Проверяет лимит, не увеличивая счётчик. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) return { allowed: true, retryAfterSec: 0 };
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Учитывает попытку (создаёт или продлевает окно). */
export function recordRateLimit(key: string, windowMs: number): void {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}

/** Проверка + учёт одной попытки; при превышении — 429. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const result = checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new TooManyRequestsError('Слишком много попыток. Попробуйте позже.', result.retryAfterSec);
  }
  recordRateLimit(key, windowMs);
}

/** Сброс при успешном действии (например, успешный вход). */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Только для тестов: сбрасывает все счётчики между сценариями. */
export function resetRateLimits(): void {
  buckets.clear();
}

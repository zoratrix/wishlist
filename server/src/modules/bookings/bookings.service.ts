import { getDb } from '../../db/index.ts';
import { AppError, ConflictError, NotFoundError, TooManyRequestsError } from '../../errors.ts';
import { hashWithSecret, newId, normalizeEmail, safeEqualHash } from '../../lib/crypto.ts';
import { isUniqueConstraintError } from '../../lib/db-errors.ts';
import type { BookingRow, GiftStatus, GiftWithBookingRow } from '../../lib/rows.ts';
import type { BookInput } from './bookings.schemas.ts';

/** Одинаковый ответ для «брони нет» и «email не тот» — факт брони не раскрываем. */
export const UNBOOK_FAILED_MESSAGE =
  'Не удалось отменить бронирование. Проверьте email, который указывали при бронировании.';
export const GIFT_GIFTED_MESSAGE = 'Этот подарок уже подарили — забронировать его нельзя.';

const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const FAILED_UNBOOK_LIMIT_PER_GIFT = 10;
const UNBOOK_LIMIT_PER_IP = 30;
const RETRY_AFTER_SEC = Math.ceil(ATTEMPT_WINDOW_MS / 1000);

export interface BookingAttemptInput {
  giftId: string;
  ipHash: string;
  emailHash: string | null;
  action: 'book' | 'unbook';
  success: boolean;
}

/** Журнал попыток: в БД только хеши IP/email, открытых значений нет. */
export function recordBookingAttempt(input: BookingAttemptInput): void {
  getDb()
    .prepare(
      `INSERT INTO booking_attempts (id, gift_id, ip_hash, email_hash, action, success, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId(),
      input.giftId,
      input.ipHash,
      input.emailHash,
      input.action,
      input.success ? 1 : 0,
      new Date().toISOString(),
    );
}

function countFailedUnbookForGift(giftId: string, since: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM booking_attempts
        WHERE gift_id = ? AND action = 'unbook' AND success = 0 AND created_at >= ?`,
    )
    .get(giftId, since) as { count: number };
  return row.count;
}

function countUnbookForIp(ipHash: string, since: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM booking_attempts
        WHERE ip_hash = ? AND action = 'unbook' AND created_at >= ?`,
    )
    .get(ipHash, since) as { count: number };
  return row.count;
}

/**
 * Бронирование атомарно: проверка статуса и вставка — в одной синхронной
 * транзакции, а гонка двух запросов дополнительно ловится частичным
 * UNIQUE-индексом `bookings_one_active_per_gift` → 409.
 */
export function bookGift(
  gift: GiftWithBookingRow,
  input: BookInput,
  ipHash: string,
): { createdAt: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const emailNorm = normalizeEmail(input.email);
  const emailHash = hashWithSecret(emailNorm);

  try {
    db.transaction(() => {
      const current = db
        .prepare('SELECT status FROM gifts WHERE id = ?')
        .get(gift.id) as { status: GiftStatus } | undefined;
      if (current === undefined) throw new NotFoundError();
      if (current.status === 'gifted') {
        throw new AppError(422, 'GIFT_GIFTED', GIFT_GIFTED_MESSAGE);
      }
      db.prepare(
        `INSERT INTO bookings
           (id, gift_id, customer_name, customer_email, customer_email_norm, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(newId(), gift.id, input.name, input.email, emailNorm, now);
    })();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      recordBookingAttempt({
        giftId: gift.id,
        ipHash,
        emailHash,
        action: 'book',
        success: false,
      });
      throw new ConflictError('GIFT_ALREADY_BOOKED', 'Этот подарок уже забронировали.');
    }
    if (error instanceof AppError) {
      recordBookingAttempt({ giftId: gift.id, ipHash, emailHash, action: 'book', success: false });
    }
    throw error;
  }

  recordBookingAttempt({ giftId: gift.id, ipHash, emailHash, action: 'book', success: true });
  return { createdAt: now };
}

/**
 * Отмена: сравниваем только хеши нормализованных email за константное время.
 * Любая неудача (нет брони / другой email) — один и тот же 400 UNBOOK_FAILED.
 * Каждая попытка пишется в booking_attempts; лимиты — 10 неудач/час на подарок
 * и 30 попыток/час на IP.
 */
export function unbookGift(gift: GiftWithBookingRow, email: string, ipHash: string): void {
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString();
  const emailNorm = normalizeEmail(email);
  const emailHash = hashWithSecret(emailNorm);

  if (
    countFailedUnbookForGift(gift.id, since) >= FAILED_UNBOOK_LIMIT_PER_GIFT ||
    countUnbookForIp(ipHash, since) >= UNBOOK_LIMIT_PER_IP
  ) {
    throw new TooManyRequestsError(
      'Слишком много попыток отмены. Попробуйте позже.',
      RETRY_AFTER_SEC,
    );
  }

  const booking = db
    .prepare('SELECT * FROM bookings WHERE gift_id = ? AND cancelled_at IS NULL')
    .get(gift.id) as BookingRow | undefined;

  const matches =
    booking !== undefined && safeEqualHash(emailHash, hashWithSecret(booking.customer_email_norm));

  if (!matches) {
    recordBookingAttempt({ giftId: gift.id, ipHash, emailHash, action: 'unbook', success: false });
    throw new AppError(400, 'UNBOOK_FAILED', UNBOOK_FAILED_MESSAGE);
  }

  db.prepare(
    `UPDATE bookings SET cancelled_at = ?, cancelled_reason = 'visitor'
      WHERE id = ? AND cancelled_at IS NULL`,
  ).run(now.toISOString(), booking.id);
  recordBookingAttempt({ giftId: gift.id, ipHash, emailHash, action: 'unbook', success: true });
}

/**
 * Свои брони глазами гостя — только в этом браузере (localStorage).
 * Сервер не знает, кто из гостей забронировал подарок, поэтому отметка
 * «Забронировано вами» живёт локально и нужна лишь для удобной отмены.
 */

export const MY_BOOKINGS_KEY = 'wl:my-bookings:v1';
export const MAX_MY_BOOKINGS = 200;

export interface MyBookingRecord {
  shareToken: string;
  giftId: string;
  name: string;
  email: string;
  createdAt: string;
}

function isRecord(value: unknown): value is MyBookingRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.shareToken === 'string' &&
    typeof record.giftId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.email === 'string' &&
    typeof record.createdAt === 'string'
  );
}

/** Чтение: недоступный/испорченный storage — просто пустой список. */
function readAll(): MyBookingRecord[] {
  try {
    const raw = window.localStorage.getItem(MY_BOOKINGS_KEY);
    if (raw === null) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

function writeAll(records: MyBookingRecord[]): void {
  try {
    window.localStorage.setItem(MY_BOOKINGS_KEY, JSON.stringify(records));
  } catch {
    // Режим инкогнито может запрещать запись — отметки просто не сохранятся.
  }
}

/** Свои брони конкретного вишлиста: giftId → запись. */
export function getBookingsForToken(token: string): Record<string, MyBookingRecord> {
  const result: Record<string, MyBookingRecord> = {};
  for (const record of readAll()) {
    if (record.shareToken === token) {
      result[record.giftId] = record;
    }
  }
  return result;
}

export function getBooking(token: string, giftId: string): MyBookingRecord | null {
  return getBookingsForToken(token)[giftId] ?? null;
}

/** Запомнить бронь; повторная запись по тому же подарку заменяет старую. */
export function rememberBooking(record: MyBookingRecord): void {
  const rest = readAll().filter(
    (item) => !(item.shareToken === record.shareToken && item.giftId === record.giftId),
  );
  rest.push(record);
  writeAll(rest.slice(-MAX_MY_BOOKINGS));
}

export function forgetBooking(shareToken: string, giftId: string): void {
  const rest = readAll().filter(
    (item) => !(item.shareToken === shareToken && item.giftId === giftId),
  );
  writeAll(rest);
}

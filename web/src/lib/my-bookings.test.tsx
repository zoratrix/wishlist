import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
 forgetBooking,
 getBooking,
 getBookingsForToken,
 MAX_MY_BOOKINGS,
 MY_BOOKINGS_KEY,
 rememberBooking,
} from './my-bookings';
import type { MyBookingRecord } from './my-bookings';

function makeRecord(giftId: string, overrides: Partial<MyBookingRecord> = {}): MyBookingRecord {
 return {
 shareToken: 'token-1',
 giftId,
 name: 'Мария',
 email: 'maria@example.com',
 createdAt: '2026-11-12T10:00:00.000Z',
 ...overrides,
 };
}

function storedRecords(): unknown[] {
 const raw = window.localStorage.getItem(MY_BOOKINGS_KEY);
 if (raw === null) {
 return [];
 }
 return JSON.parse(raw) as unknown[];
}

beforeEach(() => {
 window.localStorage.clear();
});

describe('«Мои брони» в localStorage', () => {
 it('запоминает, находит и забывает запись', () => {
 rememberBooking(makeRecord('gift-1'));

 expect(getBooking('token-1', 'gift-1')?.email).toBe('maria@example.com');
 expect(Object.keys(getBookingsForToken('token-1'))).toEqual(['gift-1']);
 expect(storedRecords()).toHaveLength(1);

 forgetBooking('token-1', 'gift-1');

 expect(getBooking('token-1', 'gift-1')).toBeNull();
 expect(storedRecords()).toHaveLength(0);
 });

 it('не смешивает брони разных вишлистов и заменяет запись того же подарка', () => {
 rememberBooking(makeRecord('gift-1', { email: 'old@example.com' }));
 rememberBooking(makeRecord('gift-1', { email: 'new@example.com' }));
 rememberBooking(makeRecord('gift-2', { shareToken: 'token-2', email: 'other@example.com' }));

 expect(getBooking('token-1', 'gift-1')?.email).toBe('new@example.com');
 expect(Object.keys(getBookingsForToken('token-1')).sort()).toEqual(['gift-1']);
 expect(Object.keys(getBookingsForToken('token-2'))).toEqual(['gift-2']);
 expect(storedRecords()).toHaveLength(2);
 });

 it('хранит не больше 200 записей', () => {
 for (let index = 0; index < MAX_MY_BOOKINGS + 5; index += 1) {
 rememberBooking(makeRecord(`gift-${index}`));
 }

 expect(storedRecords()).toHaveLength(MAX_MY_BOOKINGS);
 expect(getBooking('token-1', 'gift-0')).toBeNull();
 expect(getBooking('token-1', `gift-${MAX_MY_BOOKINGS + 4}`)).not.toBeNull();
 });

 it('не ломается на испорченных данных', () => {
 window.localStorage.setItem(MY_BOOKINGS_KEY, '{не json');
 expect(getBookingsForToken('token-1')).toEqual({});

 window.localStorage.setItem(
 MY_BOOKINGS_KEY,
 JSON.stringify([{ foo: 'bar' }, makeRecord('gift-1')]),
 );
 expect(Object.keys(getBookingsForToken('token-1'))).toEqual(['gift-1']);
 });

 it('если storage запрещён, функции не бросают исключение', () => {
 vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
 throw new Error('storage запрещён');
 });
 vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
 throw new Error('storage запрещён');
 });

 expect(() => rememberBooking(makeRecord('gift-1'))).not.toThrow();
 expect(getBookingsForToken('token-1')).toEqual({});
 expect(() => forgetBooking('token-1', 'gift-1')).not.toThrow();
 });
});

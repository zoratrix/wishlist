import { getDb } from '../../db/index.ts';
import { NotFoundError, ValidationError } from '../../errors.ts';
import type { UserRow } from '../../lib/rows.ts';
import type { ProfileUpdateInput } from './users.schemas.ts';

/** Поиск профиля по логину (в БД логин уже в нижнем регистре). */
export function findUserByUsername(username: string): UserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  return row ? (row as UserRow) : null;
}

/** Сохраняет путь к аватару (относительно uploads/) и обновляет updated_at. */
export function setUserAvatar(userId: string, storedPath: string): UserRow {
  getDb()
    .prepare('UPDATE users SET avatar_path = ?, updated_at = ? WHERE id = ?')
    .run(storedPath, new Date().toISOString(), userId);
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) throw new NotFoundError();
  return row as UserRow;
}

function daysInMonth(month: number, year: number | null): number {
  // Месяц здесь 1-based; день 0 следующего месяца = последний день текущего.
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}

function assertBirthDate(month: number | null, day: number | null, year: number | null): void {
  if (year !== null && (month === null || day === null)) {
    throw new ValidationError([
      { path: 'birthYear', message: 'Для года рождения укажите месяц и день.' },
    ]);
  }
  if (month !== null && day !== null && day > daysInMonth(month, year)) {
    throw new ValidationError([{ path: 'birthDay', message: 'Такой даты не существует.' }]);
  }
}

/**
 * Частичное обновление профиля: поля, которых нет в запросе, сохраняются;
 * `null` очищает необязательное поле. Инвариант «год требует месяц и день»
 * проверяется по итоговому состоянию, а не по отдельному полю.
 */
export function updateUserProfile(user: UserRow, input: ProfileUpdateInput): UserRow {
  const displayName = input.displayName ?? user.display_name;
  const bio = input.bio === undefined ? user.bio : input.bio;
  const birthMonth = input.birthMonth === undefined ? user.birth_month : input.birthMonth;
  const birthDay = input.birthDay === undefined ? user.birth_day : input.birthDay;
  const birthYear = input.birthYear === undefined ? user.birth_year : input.birthYear;
  const showBirthYear =
    input.showBirthYear === undefined ? user.show_birth_year === 1 : input.showBirthYear;
  const isProfilePublic =
    input.isProfilePublic === undefined ? user.is_profile_public === 1 : input.isProfilePublic;

  assertBirthDate(birthMonth, birthDay, birthYear);

  getDb()
    .prepare(
      `UPDATE users
          SET display_name = ?, bio = ?, birth_month = ?, birth_day = ?, birth_year = ?,
              show_birth_year = ?, is_profile_public = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      displayName,
      bio,
      birthMonth,
      birthDay,
      birthYear,
      showBirthYear ? 1 : 0,
      isProfilePublic ? 1 : 0,
      new Date().toISOString(),
      user.id,
    );

  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (!row) throw new Error('Пользователь исчез во время обновления профиля');
  return row as UserRow;
}

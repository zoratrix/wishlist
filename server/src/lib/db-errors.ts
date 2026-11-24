/**
 * better-sqlite3 оборачивает ошибки SQLite в Error с полем `code`
 * (`SQLITE_CONSTRAINT_UNIQUE` для нарушения UNIQUE-индекса).
 */
export function sqliteErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Нарушение уникальности (в т.ч. частичного индекса активных броней). */
export function isUniqueConstraintError(error: unknown): boolean {
  const code = sqliteErrorCode(error);
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

/** Какое именно поле уже занято — по тексту ошибки SQLite. */
export function uniqueConstraintField(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return null;
  const match = /UNIQUE constraint failed:\s*(.+)$/.exec(message);
  return match?.[1] ?? null;
}

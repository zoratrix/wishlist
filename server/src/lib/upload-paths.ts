/**
 * Пути загруженных файлов: в БД храним путь относительно папки uploads
 * (например, `avatars/<uuid>.webp`), а в API отдаём URL `/uploads/...`.
 * Функции чистые — без зависимостей от sharp/fs, чтобы их можно было
 * использовать в DTO.
 */

export const UPLOADS_URL_PREFIX = '/uploads';

/** `avatars/x.webp` → `/uploads/avatars/x.webp` (или уже готовый URL). */
export function toPublicUploadUrl(storedPath: string | null): string | null {
  if (storedPath === null || storedPath.length === 0) return null;
  if (storedPath.startsWith('/')) return storedPath;
  return `${UPLOADS_URL_PREFIX}/${storedPath}`;
}

/** Обратное преобразование: `/uploads/avatars/x.webp` → `avatars/x.webp`. */
export function toStorageRelativePath(value: string | null): string | null {
  if (value === null || value.length === 0) return null;
  const prefix = `${UPLOADS_URL_PREFIX}/`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

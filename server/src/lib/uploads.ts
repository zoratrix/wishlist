import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { config } from '../config.ts';
import { AppError } from '../errors.ts';
import { toStorageRelativePath } from './upload-paths.ts';

// Файловый кеш sharp держит дескрипторы на Windows и мешает удалять старые
// файлы; для серверной обработки загрузок кеш не нужен.
sharp.cache(false);

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const INVALID_IMAGE_MESSAGE = 'Не удалось прочитать изображение. Поддерживаются JPEG, PNG и WebP.';
const MAX_FILE_SIZE = config.MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

/**
 * Приём одного файла в память (поле `file`). Ошибки multer переводим в
 * понятные ответы: превышение размера → 413, прочее → 400 INVALID_IMAGE.
 * Проверка «это действительно картинка» — по содержимому в sharp (ниже).
 */
export function uploadImage(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (error === undefined || error === null) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            413,
            'PAYLOAD_TOO_LARGE',
            `Файл слишком большой. Максимум ${config.MAX_UPLOAD_MB} МБ.`,
          ),
        );
        return;
      }
      next(new AppError(400, 'INVALID_IMAGE', INVALID_IMAGE_MESSAGE));
      return;
    }
    next(error);
  });
}

export interface ImageVariant {
  folder: 'avatars' | 'covers';
  width: number;
  height: number;
}

/**
 * Проверяет изображение по магическим байтам (sharp metadata), ресайзит
 * «cover» до нужного размера, удаляет метаданные и сохраняет WebP.
 * Возвращает путь относительно папки uploads (то, что пишем в БД).
 */
export async function saveResizedImage(buffer: Buffer, variant: ImageVariant): Promise<string> {
  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const metadata = await sharp(buffer).metadata();
    format = metadata.format;
    width = metadata.width;
    height = metadata.height;
  } catch {
    throw new AppError(400, 'INVALID_IMAGE', INVALID_IMAGE_MESSAGE);
  }
  if (
    format === undefined ||
    !ALLOWED_FORMATS.has(format) ||
    (width ?? 0) < 1 ||
    (height ?? 0) < 1
  ) {
    throw new AppError(400, 'INVALID_IMAGE', INVALID_IMAGE_MESSAGE);
  }

  const folderDir = path.join(config.uploadDir, variant.folder);
  fs.mkdirSync(folderDir, { recursive: true });
  const relativePath = `${variant.folder}/${crypto.randomUUID()}.webp`;
  const destination = path.join(config.uploadDir, relativePath);

  try {
    await sharp(buffer)
      .rotate() // учитываем EXIF-ориентацию, метаданные дальше не сохраняются
      .resize(variant.width, variant.height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toFile(destination);
  } catch {
    fs.rmSync(destination, { force: true });
    throw new AppError(400, 'INVALID_IMAGE', INVALID_IMAGE_MESSAGE);
  }
  return relativePath;
}

/** Удаляет старый файл по значению из БД; не выходит за пределы uploads/. */
export function removeStoredImage(storedPath: string | null): void {
  const relativePath = toStorageRelativePath(storedPath);
  if (relativePath === null) return;

  const uploadRoot = path.resolve(config.uploadDir);
  const absolutePath = path.resolve(uploadRoot, relativePath);
  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return;

  try {
    fs.rmSync(absolutePath, { force: true });
  } catch {
    // Файла уже нет — не ошибка: главное, что БД ссылается на новый.
  }
}

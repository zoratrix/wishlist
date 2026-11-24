import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger.ts';

/**
 * Ожидаемая ошибка с понятным пользователю сообщением.
 * Все сообщения — на русском, без технических подробностей и без чужих данных.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(details?: unknown) {
    super(400, 'VALIDATION_ERROR', 'Проверьте введённые данные.', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Нужно войти в аккаунт.') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Недостаточно прав для этого действия.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Страница не найдена или недоступна.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Слишком много попыток. Попробуйте позже.', retryAfterSec = 60) {
    super(429, 'TOO_MANY_REQUESTS', message, { retryAfterSec });
  }
}

/** 404 для неизвестных адресов API. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Страница не найдена или недоступна.', details: null },
  });
}

/** Единый обработчик ошибок: клиенту — понятный текст, в журнал — подробности. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    logger.error('Ошибка после отправки ответа', err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details ?? null },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте введённые данные.',
        details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }

  // Некорректный JSON в теле запроса (ошибка body-parser).
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const type = (err as { type?: unknown }).type;
    if (type === 'entity.parse.failed') {
      res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Некорректный формат запроса.', details: null },
      });
      return;
    }
    if (type === 'entity.too.large') {
      res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Слишком большой запрос.', details: null },
      });
      return;
    }
  }

  logger.error('Необработанная ошибка', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера. Попробуйте ещё раз.', details: null },
  });
}

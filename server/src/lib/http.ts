import type { Request } from 'express';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../errors.ts';
import { hashWithSecret } from './crypto.ts';
import { toValidationDetails } from './validation.ts';

/** Минимальный контракт схемы Zod — чтобы не зависеть от сложных дженериков. */
export interface BodySchema<T> {
  parse(input: unknown): T;
}

/** Разбор тела запроса через Zod с русскими сообщениями об ошибках. */
export function parseBody<T>(req: Request, schema: BodySchema<T>): T {
  try {
    return schema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(toValidationDetails(error));
    }
    throw error;
  }
}

/** Параметр пути: пустой/отсутствующий превращается в 404, а не в падение. */
export function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) throw new NotFoundError();
  return value;
}

/** IP клиента с учётом `trust proxy` (в production — один обратный прокси). */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** В БД пишем только хеш IP. */
export function clientIpHash(req: Request): string {
  return hashWithSecret(clientIp(req));
}

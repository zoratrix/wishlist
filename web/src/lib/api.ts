/**
 * Клиент нашего API (docs/API-CONTRACT-MVP.md).
 * - credentials: same-origin (cookie `sid` — httpOnly);
 * - небезопасные методы несут X-CSRF-Token из читаемой cookie `csrf`;
 * - любая ошибка превращается в ApiError с понятным русским текстом.
 */

export interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const NETWORK_ERROR_MESSAGE =
  'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.';

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Читает cookie по имени (нужно для CSRF-токена). */
export function readCookie(name: string): string | null {
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`);
  const match = pattern.exec(document.cookie);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function defaultMessageForStatus(status: number): string {
  if (status === 401) return 'Требуется вход в аккаунт.';
  if (status === 403) return 'Не хватает прав для этого действия.';
  if (status === 404) return 'Ничего не найдено.';
  if (status === 409) return 'Действие уже выполнено.';
  if (status === 422) return 'Проверьте введённые данные.';
  if (status === 429) return 'Слишком много попыток. Попробуйте позже.';
  if (status >= 500) return 'Сервер не смог выполнить запрос. Попробуйте ещё раз.';
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

/** Понятный пользователю текст ошибки. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET') {
    const csrfToken = readCookie('csrf');
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const init: RequestInit = { method, headers, credentials: 'same-origin' };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE, 'NETWORK_ERROR');
  }

  const text = await response.text();
  const payload = text ? parseJson(text) : null;

  if (!response.ok) {
    const error = (payload as ApiErrorPayload | null)?.error;
    throw new ApiError(
      response.status,
      error?.message ?? defaultMessageForStatus(response.status),
      error?.code,
      error?.details,
    );
  }

  // 204 — тела нет; вызывающий код ожидает void.
  return payload as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

/**
 * Multipart-загрузка (аватар, обложка). Content-Type выставляет сам браузер,
 * поэтому заголовок не задаём; CSRF-токен добавляем как для POST.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const csrfToken = readCookie('csrf');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE, 'NETWORK_ERROR');
  }

  const text = await response.text();
  const payload = text ? parseJson(text) : null;

  if (!response.ok) {
    const error = (payload as ApiErrorPayload | null)?.error;
    throw new ApiError(
      response.status,
      error?.message ?? defaultMessageForStatus(response.status),
      error?.code,
      error?.details,
    );
  }

  return payload as T;
}

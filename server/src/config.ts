import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/** Папка server/ */
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Корень проекта (папка, где лежат package.json, .env, docs) */
export const ROOT_DIR = path.resolve(SERVER_DIR, '..');

// Настройки читаются из .env в корне проекта.
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

/** Необязательный флаг из .env: отсутствие/пустая строка означает «не задано». */
const optionalBooleanish = z
  .string()
  .optional()
  .transform((value) =>
    value === undefined || value.trim() === '' ? undefined : value === 'true' || value === '1',
  );

/** Адрес сайта по умолчанию: и для APP_URL, и для ссылок в письмах. */
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  APP_URL: z.string().url().default(DEFAULT_APP_ORIGIN),
  /** Базовый адрес сайта для ссылок в письмах (восстановление пароля). */
  APP_ORIGIN: z.string().url().default(DEFAULT_APP_ORIGIN),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET должен быть не короче 16 символов'),
  HASH_SECRET: z.string().min(16, 'HASH_SECRET должен быть не короче 16 символов'),

  DATABASE_PATH: z.string().min(1).default('./server/data/app.db'),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(5),

  // Пустой SMTP_HOST — осознанный режим: почта не настроена (console).
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: optionalBooleanish,
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('no-reply@hotelets.local'),

  YANDEX_CLIENT_ID: z.string().default(''),
  YANDEX_CLIENT_SECRET: z.string().default(''),
  YANDEX_REDIRECT_URI: z.string().default('http://localhost:3000/api/auth/yandex/callback'),

  TZ: z.string().default('Europe/Moscow'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`);
  // Понятное сообщение вместо stack trace — проект должен быть дружелюбным.
  console.error(
    [
      '',
      'Не удалось прочитать настройки из файла .env.',
      'Проблемы:',
      ...problems,
      '',
      'Что делать: скопируйте файл .env.example в .env и заполните значения',
      '(в инструкции это шаг «Настройка переменных окружения»).',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

const env = parsed.data;

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
}

const smtpHost = env.SMTP_HOST.trim();
const smtpFrom = env.SMTP_FROM.trim();

export const config = {
  ...env,
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  isProd: env.NODE_ENV === 'production',
  /** Почта настроена, только если явно задан SMTP_HOST. */
  smtpConfigured: smtpHost.length > 0,
  /** Порт 465 — сразу TLS, иначе STARTTLS (587) / открытый SMTP (1025, Mailpit). */
  smtpSecure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
  smtpFrom: smtpFrom.length > 0 ? smtpFrom : 'no-reply@hotelets.local',
  rootDir: ROOT_DIR,
  serverDir: SERVER_DIR,
  databasePath: resolveFromRoot(env.DATABASE_PATH),
  uploadDir: resolveFromRoot(env.UPLOAD_DIR),
  webDistDir: path.join(ROOT_DIR, 'web', 'dist'),
} as const;

export type Config = typeof config;

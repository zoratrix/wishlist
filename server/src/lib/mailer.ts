import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

/** Письмо, которое умеет отправить транспорт. */
export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

/**
 * Минимальный контракт транспорта: nodemailer-транспорт подходит структурно,
 * а в тестах его можно подменить без сети (см. setTransportForTests).
 */
export interface MailTransport {
  sendMail(message: MailMessage): Promise<unknown>;
}

const PASSWORD_RESET_SUBJECT = 'Восстановление пароля на «Хотелки»';

/** Транспорт, подменённый тестом; имеет приоритет над SMTP из настроек. */
let testTransport: MailTransport | null = null;
let smtpTransport: Transporter | null = null;

/** Настроен ли SMTP. Если нет — письма не отправляются, ссылка пишется в журнал. */
export function isSmtpConfigured(): boolean {
  return config.smtpConfigured;
}

/** Только для тестов: подменить транспорт (null — вернуть обычное поведение). */
export function setTransportForTests(transport: MailTransport | null): void {
  testTransport = transport;
}

function getTransport(): MailTransport | null {
  if (testTransport !== null) return testTransport;
  if (!config.smtpConfigured) return null;
  smtpTransport ??= createTransport({
    host: config.SMTP_HOST.trim(),
    port: config.SMTP_PORT,
    secure: config.smtpSecure,
    auth:
      config.SMTP_USER.length > 0
        ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
        : undefined,
  });
  return smtpTransport;
}

/** Текст письма на русском: ссылка, срок действия и предупреждение. */
export function buildPasswordResetText(resetUrl: string): string {
  return [
    'Здравствуйте!',
    '',
    'Вы запросили восстановление пароля на платформе «Хотелки».',
    'Чтобы задать новый пароль, перейдите по ссылке:',
    resetUrl,
    '',
    'Ссылка действует 1 час и работает только один раз.',
    'Если это были не вы — просто проигнорируйте это письмо. Пароль останется прежним.',
    '',
    'С уважением, команда «Хотелки»',
  ].join('\n');
}

export type PasswordResetDelivery = 'smtp' | 'console';

/**
 * Отправляет письмо со ссылкой на восстановление пароля.
 * Если SMTP не настроен, письмо не уходит: ссылка пишется в журнал (режим
 * console) — этого достаточно для локальной проверки сценария.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<PasswordResetDelivery> {
  const transport = getTransport();
  if (transport === null) {
    // Персональные данные (email) в журнал не попадают.
    logger.info(
      `SMTP не настроен: письмо не отправлено. Ссылка для восстановления пароля: ${resetUrl}`,
    );
    return 'console';
  }

  await transport.sendMail({
    from: config.smtpFrom,
    to,
    subject: PASSWORD_RESET_SUBJECT,
    text: buildPasswordResetText(resetUrl),
  });
  return 'smtp';
}

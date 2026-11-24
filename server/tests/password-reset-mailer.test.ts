import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.ts';
import { logger } from '../src/logger.ts';
import { isSmtpConfigured, setTransportForTests } from '../src/lib/mailer.ts';
import type { MailMessage } from '../src/lib/mailer.ts';
import { createTestApp, registerUser, resetAll } from './helpers.ts';

const FORGOT_URL = '/api/auth/forgot-password';

let app: Express;

beforeEach(() => {
  resetAll();
  setTransportForTests(null);
  app = createTestApp();
});

function tokenFromDebugUrl(debugUrl: unknown): string {
  expect(typeof debugUrl).toBe('string');
  return new URL(String(debugUrl)).searchParams.get('token') ?? '';
}

describe('mailer', () => {
  it('в тестовом окружении SMTP не настроен — режим console', () => {
    expect(isSmtpConfigured()).toBe(false);
  });

  it('отправляет русское письмо со ссылкой через подменённый транспорт', async () => {
    const auth = await registerUser(app, {}, '10.40.0.1');
    const messages: MailMessage[] = [];
    setTransportForTests({
      async sendMail(message) {
        messages.push(message);
        return {};
      },
    });

    const response = await request(app)
      .post(FORGOT_URL)
      .set('X-Forwarded-For', '10.40.0.2')
      .send({ email: auth.email });
    expect(response.status).toBe(200);
    expect(messages).toHaveLength(1);

    const message = messages[0];
    expect(message).toBeDefined();
    if (message === undefined) return;

    expect(message.from).toBe(config.smtpFrom);
    expect(message.from).toContain('@');
    expect(message.to).toBe(auth.email);
    expect(message.subject).toMatch(/[а-яА-ЯёЁ]/);
    expect(message.text).toMatch(/[а-яА-ЯёЁ]/);

    const token = tokenFromDebugUrl(response.body.debugUrl);
    expect(message.text).toContain(`${config.APP_ORIGIN}/reset-password?token=${token}`);
    expect(message.text).toContain('1 час');
    expect(message.text).toContain('проигнорируйте');
  });

  it('без SMTP не отправляет письмо, а пишет ссылку в журнал (без email)', async () => {
    const auth = await registerUser(app, {}, '10.40.0.3');
    const infoSpy = vi.spyOn(logger, 'info');
    try {
      const response = await request(app)
        .post(FORGOT_URL)
        .set('X-Forwarded-For', '10.40.0.4')
        .send({ email: auth.email });
      expect(response.status).toBe(200);

      const token = tokenFromDebugUrl(response.body.debugUrl);
      const logged = infoSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('/reset-password?token=');
      expect(logged).toContain(token);
      expect(logged).not.toContain(auth.email);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it('ошибка отправки не меняет ответ API и не попадает в журнал с email', async () => {
    const auth = await registerUser(app, {}, '10.40.0.5');
    setTransportForTests({
      async sendMail() {
        throw new Error('SMTP недоступен');
      },
    });
    const errorSpy = vi.spyOn(logger, 'error');
    try {
      const response = await request(app)
        .post(FORGOT_URL)
        .set('X-Forwarded-For', '10.40.0.6')
        .send({ email: auth.email });
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(typeof response.body.debugUrl).toBe('string');
      expect(errorSpy).toHaveBeenCalled();

      const logged = errorSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).not.toContain(auth.email);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

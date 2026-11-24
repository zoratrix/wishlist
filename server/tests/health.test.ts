import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.ts';

describe('GET /api/health', () => {
  it('отвечает 200 и подтверждает работу базы', async () => {
    const response = await request(createApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.db).toBe('ok');
    expect(response.body.version).toBe('0.1.0');
    expect(typeof response.body.uptimeSec).toBe('number');
  });

  it('на неизвестный адрес API отвечает 404 в едином формате', async () => {
    const response = await request(createApp()).get('/api/unknown-endpoint');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(typeof response.body.error.message).toBe('string');
  });
});

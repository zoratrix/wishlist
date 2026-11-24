import { Router } from 'express';
import { config } from '../config.ts';
import { getDb } from '../db/index.ts';

export const healthRouter = Router();

const startedAt = Date.now();
const APP_VERSION = '0.1.0';

/** Проверка работоспособности: сервер жив и база отвечает. */
healthRouter.get('/health', (_req, res) => {
  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    getDb().prepare('SELECT 1 AS ok').get();
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : String(error);
  }

  res.status(databaseOk ? 200 : 503).json({
    status: databaseOk ? 'ok' : 'degraded',
    db: databaseOk ? 'ok' : 'error',
    // Техническую причину показываем только в разработке.
    ...(config.isProd ? {} : { dbError: databaseError }),
    version: APP_VERSION,
    env: config.NODE_ENV,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  });
});

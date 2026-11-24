import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { errorHandler, notFoundHandler } from './errors.ts';
import { healthRouter } from './routes/health.ts';
import { apiRouter } from './api.ts';

export interface CreateAppOptions {
  /**
   * Дополнительный обработчик перед отдачей сайта.
   * В разработке сюда подключается Vite (middleware mode), в production — не нужен.
   */
  siteMiddleware?: express.RequestHandler;
  /** Отдавать ли собранный сайт из web/dist. По умолчанию да (production). */
  serveBuiltSite?: boolean;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const { siteMiddleware, serveBuiltSite = true } = options;
  const app = express();

  app.disable('x-powered-by');
  // Один обратный прокси (Caddy в production).
  app.set('trust proxy', 1);

  // Заголовки безопасности. CSP выключен в разработке: страницу отдаёт Vite
  // со своими вставками и временем жизни модулей.
  app.use(
    helmet({
      contentSecurityPolicy: config.isDev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Короткий журнал запросов.
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      logger.debug(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started} мс)`);
    });
    next();
  });

  // API
  app.use('/api', healthRouter);
  app.use('/api', apiRouter);

  // Загруженные картинки
  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      maxAge: '365d',
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  // Сайт: Vite в разработке, собранные файлы в production.
  if (siteMiddleware) {
    app.use(siteMiddleware);
  } else if (serveBuiltSite) {
    const indexHtml = path.join(config.webDistDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(config.webDistDir, { index: false, maxAge: '1h' }));
      app.get(/^(?!\/(?:api|uploads)(?:\/|$)).*/, (_req, res) => {
        res.sendFile(indexHtml);
      });
    }
  }

  // Всё остальное — 404 в формате API или страница 404 сайта (забота SPA).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

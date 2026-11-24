import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../../errors.ts';
import { clientIp, parseBody } from '../../lib/http.ts';
import { enforceRateLimit, clearRateLimit } from '../../lib/rate-limit.ts';
import { logger } from '../../logger.ts';
import { sendPasswordResetEmail } from '../../lib/mailer.ts';
import { toUserSelfDTO } from '../../lib/dto.ts';
import {
  clearSessionCookies,
  createSession,
  destroySession,
  getViewer,
  setCsrfCookie,
  setSessionCookies,
} from '../../lib/session.ts';
import { authenticateUser, registerUser } from './auth.service.ts';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas.ts';
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  resetPasswordWithToken,
  shouldExposeDebugUrl,
} from './password-reset.service.ts';
import { getUserFollowCounts } from '../follows/follows.service.ts';

const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_LIMIT = 5;
const FORGOT_WINDOW_MS = 60 * 60 * 1000;

const INVALID_CREDENTIALS_MESSAGE = 'Неверный email или пароль.';

export const authRouter = Router();

authRouter.post('/auth/register', (req: Request, res: Response) => {
  const body = parseBody(req, registerSchema);
  enforceRateLimit(`register:${clientIp(req)}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);

  const { user, session, token } = registerUser(body, req);
  setSessionCookies(res, session, token);
  res.status(201).json({ user: toUserSelfDTO(user, { followersCount: 0, followingCount: 0 }) });
});

authRouter.post('/auth/login', (req: Request, res: Response) => {
  const body = parseBody(req, loginSchema);
  const rateKey = `login:${clientIp(req)}:${body.email}`;
  enforceRateLimit(rateKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);

  const user = authenticateUser(body.email, body.password);
  if (user === null) {
    // Один и тот же ответ для несуществующего email и неверного пароля.
    throw new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);
  }

  clearRateLimit(rateKey);
  const { session, token } = createSession(user.id, req);
  setSessionCookies(res, session, token);
  res.status(200).json({ user: toUserSelfDTO(user, getUserFollowCounts(user.id)) });
});

authRouter.post('/auth/logout', (req: Request, res: Response) => {
  const viewer = getViewer(res);
  if (viewer !== null) destroySession(viewer.session.id);
  clearSessionCookies(res);
  res.status(204).end();
});

authRouter.get('/auth/me', (req: Request, res: Response) => {
  const viewer = getViewer(res);
  if (viewer !== null) setCsrfCookie(res, viewer.session);
  res.status(200).json({
    user:
      viewer === null ? null : toUserSelfDTO(viewer.user, getUserFollowCounts(viewer.user.id)),
  });
});

/**
 * Запрос ссылки для восстановления пароля. Ответ всегда одинаковый, чтобы по
 * нему нельзя было узнать, зарегистрирован ли email: для неизвестного адреса
 * токен не создаётся, но клиент видит тот же 200.
 */
authRouter.post('/auth/forgot-password', async (req: Request, res: Response) => {
  const body = parseBody(req, forgotPasswordSchema);
  // Лимиты на IP и на email; код ответа общий — не раскрываем, что именно ограничено.
  enforceRateLimit(`forgot:ip:${clientIp(req)}`, FORGOT_LIMIT, FORGOT_WINDOW_MS);
  enforceRateLimit(`forgot:email:${body.email}`, FORGOT_LIMIT, FORGOT_WINDOW_MS);

  const created = createPasswordResetToken(body.email);
  const payload: { ok: true; debugUrl?: string } = { ok: true };

  if (created !== null) {
    const resetUrl = buildPasswordResetUrl(created.token);
    try {
      await sendPasswordResetEmail(body.email, resetUrl);
    } catch (error) {
      // Клиенту отвечаем так же; в журнал — технические детали без email.
      logger.error('Не удалось отправить письмо для восстановления пароля', error);
    }
    // Вне production без SMTP ссылку можно взять из ответа — для локальной проверки.
    if (shouldExposeDebugUrl()) payload.debugUrl = resetUrl;
  }

  res.status(200).json(payload);
});

/** Установка нового пароля по одноразовой ссылке. Выход со всех устройств. */
authRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  const body = parseBody(req, resetPasswordSchema);
  resetPasswordWithToken(body.token, body.password);
  // Сессии в БД удалены; стираем и cookie, чтобы клиент не присылал мусор.
  clearSessionCookies(res);
  res.status(204).end();
});

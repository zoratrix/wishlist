import { z } from 'zod';

/** Email нормализуется: trim + нижний регистр (единое правило проекта). */
export const emailSchema = z
  .string({ error: 'Введите email.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Введите корректный email.'));

export const passwordSchema = z
  .string({ error: 'Введите пароль.' })
  .min(8, 'Пароль должен быть не короче 8 символов.')
  .max(200, 'Пароль слишком длинный.');

export const usernameSchema = z
  .string({ error: 'Введите логин.' })
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    'Логин: от 3 до 20 символов — латинские буквы, цифры и «_».',
  );

export const displayNameSchema = z
  .string({ error: 'Введите имя.' })
  .trim()
  .min(1, 'Имя не может быть пустым.')
  .max(100, 'Имя должно быть не длиннее 100 символов.');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  username: usernameSchema,
  emailNotifications: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Введите пароль.' }).min(1, 'Введите пароль.'),
});

/** Запрос ссылки для восстановления пароля: раскрывать существование email нельзя. */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/** Установка нового пароля по одноразовому токену из письма. */
export const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'Введите токен из письма.' })
    .trim()
    .min(1, 'Введите токен из письма.')
    .max(200, 'Токен слишком длинный.'),
  // Та же политика пароля, что при регистрации.
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

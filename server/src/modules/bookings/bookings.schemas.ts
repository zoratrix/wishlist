import { z } from 'zod';

/** Email посетителя: сохраняем как ввёл (нормализация — при сравнении/хеше). */
const visitorEmailSchema = z
  .string({ error: 'Введите email.' })
  .trim()
  .pipe(z.email('Введите корректный email.'));

export const bookSchema = z.object({
  name: z
    .string({ error: 'Введите имя.' })
    .trim()
    .min(1, 'Введите имя.')
    .max(100, 'Имя должно быть не длиннее 100 символов.'),
  email: visitorEmailSchema,
});

export const unbookSchema = z.object({ email: visitorEmailSchema });

export type BookInput = z.infer<typeof bookSchema>;
export type UnbookInput = z.infer<typeof unbookSchema>;

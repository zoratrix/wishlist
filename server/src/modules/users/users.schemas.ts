import { z } from 'zod';
import { displayNameSchema } from '../auth/auth.schemas.ts';

/**
 * PATCH профиля: передаются только изменяемые поля, `null` очищает
 * необязательное поле (bio, дата рождения).
 */
export const profileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  bio: z
    .string({ error: 'Описание должно быть текстом.' })
    .max(300, 'Описание должно быть не длиннее 300 символов.')
    .nullable()
    .optional(),
  birthMonth: z
    .number({ error: 'Месяц рождения должен быть числом.' })
    .int('Месяц рождения должен быть целым числом.')
    .min(1, 'Месяц рождения — от 1 до 12.')
    .max(12, 'Месяц рождения — от 1 до 12.')
    .nullable()
    .optional(),
  birthDay: z
    .number({ error: 'День рождения должен быть числом.' })
    .int('День рождения должен быть целым числом.')
    .min(1, 'День рождения — от 1 до 31.')
    .max(31, 'День рождения — от 1 до 31.')
    .nullable()
    .optional(),
  birthYear: z
    .number({ error: 'Год рождения должен быть числом.' })
    .int('Год рождения должен быть целым числом.')
    .min(1900, 'Год рождения — от 1900 до 2100.')
    .max(2100, 'Год рождения — от 1900 до 2100.')
    .nullable()
    .optional(),
  showBirthYear: z.boolean().optional(),
  isProfilePublic: z.boolean().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

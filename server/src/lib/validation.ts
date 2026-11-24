import { z } from 'zod';

/**
 * Человекочитаемые (русские) сообщения о полях формы.
 * Ключ — путь поля в теле запроса; вложенность — через точку.
 */
const FIELD_LABELS: Record<string, string> = {
  email: 'email',
  password: 'пароль',
  username: 'логин',
  displayName: 'имя',
  bio: 'описание',
  birthMonth: 'месяц рождения',
  birthDay: 'день рождения',
  birthYear: 'год рождения',
  showBirthYear: 'показ года рождения',
  isProfilePublic: 'публичность профиля',
  title: 'название',
  description: 'описание',
  eventDate: 'дата события',
  visibility: 'видимость',
  showBooked: 'показ броней',
  showBookerNames: 'показ имён бронирующих',
  links: 'ссылки',
  priceMinor: 'цена',
  currency: 'валюта',
  priority: 'приоритет',
  status: 'статус',
  order: 'порядок',
  wishlistId: 'вишлист',
  name: 'имя',
  emailNotifications: 'уведомления по почте',
};

function fieldLabel(path: ReadonlyArray<PropertyKey>): string {
  const parts = path.map((part) => String(part)).filter((part) => part.length > 0 && !/^\d+$/.test(part));
  const key = parts.join('.');
  if (key.length === 0) return '';
  // Для вложенных полей (order.0) берём последний смысловой сегмент.
  const last = parts[parts.length - 1] ?? key;
  return FIELD_LABELS[key] ?? FIELD_LABELS[last] ?? key;
}

function defaultMessage(code: string, label: string): string {
  const field = label.length > 0 ? `Поле «${label}»` : 'Поле';
  switch (code) {
    case 'invalid_type':
      return `${field}: обязательное значение.`;
    case 'too_small':
      return `${field}: значение слишком маленькое или короткое.`;
    case 'too_big':
      return `${field}: значение слишком большое или длинное.`;
    case 'invalid_format':
      return `${field}: неверный формат.`;
    case 'invalid_value':
      return `${field}: недопустимое значение.`;
    default:
      return `${field}: проверьте значение.`;
  }
}

const RUSSIAN_TEXT = /[а-яА-ЯёЁ]/;

/** Приводит ошибки Zod к русским сообщениям для `details` ответа API. */
export function toValidationDetails(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => {
    const label = fieldLabel(issue.path);
    // Свои сообщения в схемах уже на русском — оставляем их.
    const message = RUSSIAN_TEXT.test(issue.message) ? issue.message : defaultMessage(issue.code, label);
    return { path: issue.path.map((part) => String(part)).join('.'), message };
  });
}

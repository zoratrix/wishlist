# Контракт API для MVP (этап 2)

Это **точная спецификация** запросов/ответов для этапа 2. Источник‑истина для
backend и frontend. Дополняет `docs/API.md` (общие правила) и `docs/DATABASE.md`
(схема). Расхождения — исправлять здесь и синхронизировать с обеими частями.

## 0. Общие правила

- Префикс `/api`, JSON, кодировка UTF‑8.
- Cookie:
  - `sid` — httpOnly, SameSite=Lax, срок 30 дней, `Secure` в production;
  - `csrf` — читаемая JS (не httpOnly), SameSite=Lax; значение равно
    `csrf_token` серверной сессии.
- Для всех `POST/PATCH/DELETE`, где пользователь авторизован (есть `sid`),
  обязателен заголовок `X-CSRF-Token` со значением из cookie `csrf`.
  Несовпадение → `403 CSRF_FAILED`. Для гостевых запросов (register/login/
  бронирование) проверка не требуется.
- Ответы об ошибках: `{ "error": { "code": "...", "message": "по-русски", "details": null } }`.
- Частичное обновление (`PATCH`): передаются только изменяемые поля; `null`
  очищает необязательное поле.
- Даты: `YYYY-MM-DD` для дат, ISO 8601 UTC для моментов времени.
- `priceMinor` — цена в копейках (целое ≥ 0) или `null`.
- Параметры аутентификации: пароль минимум 8 символов; email нормализуется
  (`trim` + нижний регистр); `username` — `^[a-z0-9_]{3,20}$` (сервер приводит
  к нижнему регистру).

## 1. DTO (формы данных)

### UserSelfDTO (владелец аккаунта)
```json
{ "id": "uuid", "email": "a@b.ru", "username": "anna", "displayName": "Анна",
  "bio": "…", "avatarPath": null, "birthMonth": 4, "birthDay": 15,
  "birthYear": 1992, "showBirthYear": true, "isProfilePublic": true,
  "createdAt": "2026-11-12T09:00:00.000Z" }
```

### UserPublicDTO
То же без `email`; `birthYear` включается только если `showBirthYear = true`,
иначе `null`.

### WishlistSummaryDTO
```json
{ "id": "uuid", "title": "День рождения", "description": "…", "coverPath": null,
  "eventDate": "2026-12-20", "visibility": "link",
  "shareToken": "k7M2pQ9", "sortOrder": 0,
  "showBooked": false, "showBookerNames": false, "giftCount": 5,
  "createdAt": "…", "updatedAt": "…" }
```

### GiftDTO
```json
{ "id": "uuid", "title": "Наушники", "description": "Чёрные, с шумоподавлением",
  "links": ["https://…", "https://…"],
  "categories": [{ "id": "uuid", "name": "Электроника" }],
  "priceMinor": 2999000, "currency": "RUB", "priority": 1,
  "status": "available", "sortOrder": 0,
  "booking": null,
  "createdAt": "…", "updatedAt": "…" }
```
- `links`: массив ссылок на товар, **0–10 штук**, порядок сохраняется как ввёл
  пользователь. Один подарок может иметь несколько вариантов (например, плед
  понравился в трёх магазинах). Ссылки показываются как отдельные кнопки
  «Открыть», их количество не ограничивается одной.
- `categories`: **0–5 тегов** вишлиста, к которому относится подарок; порядок —
  по алфавиту. Пустой массив — подарок без категории.
- `description`: до 2000 символов; в интерфейсе может быть основной колонкой.
- `status`: только `"available"` или `"gifted"` (факт брони выражается полем
  `booking`).
- `booking`:
  - `null` — брони нет **или** смотрящий не имеет права её видеть;
  - `{ "status": "booked" }` — гость видит, что занято;
  - `{ "status": "booked", "bookerName": "Мария" }` — владелец при
    `showBooked = true` **и** `showBookerNames = true`;
  - при `showBooked = false` владелец **не получает** `booking` вообще (`null`),
    как если бы брони не было. Email бронирующего не отдаётся никогда.
- `booking` никогда не содержит email, id брони, времени брони.

## 2. Авторизация

| Метод | Путь | Тело | Успех |
|---|---|---|---|
| POST | `/api/auth/register` | `{email, password, displayName, username, emailNotifications?}` | `201 { user }` + cookies |
| POST | `/api/auth/login` | `{email, password}` | `200 { user }` + cookies |
| POST | `/api/auth/logout` | — | `204`, cookies удалены |
| GET | `/api/auth/me` | — | `200 { user: UserSelfDTO \| null }`, при наличии сессии выставляет `csrf` cookie |
| PATCH | `/api/me/profile` | любые из `displayName, bio, birthMonth, birthDay, birthYear, showBirthYear, isProfilePublic` | `200 { user }` |
| GET | `/api/users/:username` | — | `200 { user: UserPublicDTO, wishlists: WishlistSummaryDTO[] }` |

Ошибки авторизации: `401 INVALID_CREDENTIALS` (неверный email/пароль, один и
тот же текст), `409 EMAIL_TAKEN`, `409 USERNAME_TAKEN`, `400 VALIDATION_ERROR`,
`429 TOO_MANY_REQUESTS`.

Регистрация: сразу создаёт сессию (входит). Подтверждение email — на этапе 4.
Публичный профиль закрытого (`isProfilePublic=false`) пользователя отдаётся
только ему самому; остальным — `404`.

## 2.1. Социальные функции (этап 3)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/users/:username` | — | `200 { user: UserPublicDTO, wishlists: WishlistSummaryDTO[], viewer: { isSelf, isFollowing, canFollow } }` |
| POST | `/api/users/:username/follow` | — | `200 { isFollowing: true }` |
| DELETE | `/api/users/:username/follow` | — | `200 { isFollowing: false }` |
| GET | `/api/me/followers` | — | `200 { users: FollowUserDTO[], total }` |
| GET | `/api/me/following` | — | `200 { users: FollowUserDTO[], total }` |
| DELETE | `/api/me/followers/:userId` | — | `204` (удалить подписчика) |

### FollowUserDTO
```json
{ "id": "uuid", "username": "anna", "displayName": "Анна", "bio": "…",
  "avatarPath": null, "followedAt": "2026-11-13T10:00:00.000Z" }
```

Правила:
- подписка односторонняя и идемпотентная (повторный POST — `200`, запись не
  дублируется); на себя нельзя → `400 CANNOT_FOLLOW_SELF`; на закрытый профиль
  нельзя → `404`;
- списки подписчиков/подписок и счётчики (`followersCount`, `followingCount` в
  `UserSelfDTO`) видит **только владелец**; остальным эти поля не отдаются;
- публичный профиль закрытого пользователя (`isProfilePublic=false`) → `404`
  всем, кроме владельца;
- у закрытого профиля существующие подписки сохраняются (новые запрещены);
- вишлисты в публичном профиле: `public` — всем; `followers` — только
  подписчикам; `link` — в списке профиля не показываются (доступ только по
  ссылке); владельцу — все;
- подписка/отписка не отправляет писем (уведомления — этап 4).

## 3. Вишлисты владельца

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/me/wishlists` | — | `200 { wishlists: WishlistSummaryDTO[] }` |
| POST | `/api/me/wishlists` | `{title, description?, eventDate?, visibility?}` | `201 { wishlist }` |
| GET | `/api/me/wishlists/:id` | — | `200 { wishlist, gifts: GiftDTO[], categories: CategoryDTO[] }` |
| PATCH | `/api/me/wishlists/:id` | `title?, description?, eventDate?, visibility?, showBooked?, showBookerNames?` | `200 { wishlist }` |
| DELETE | `/api/me/wishlists/:id` | — | `204` |
| POST | `/api/me/wishlists/reorder` | `{ order: [wishlistId, …] }` | `204` |
| POST | `/api/me/wishlists/:id/share-token` | — | `200 { wishlist }` — новый короткий `shareToken`, **старая ссылка перестаёт работать** |
| POST | `/api/me/wishlists/:id/categories` | `{ name, color? }` | `201 { category }` |
| PATCH | `/api/me/categories/:id` | `{ name?, color? }` | `200 { category }` |
| DELETE | `/api/me/categories/:id` | — | `204` |

### CategoryDTO
```json
{ "id": "uuid", "name": "Книги", "color": "#4C6B92" }
```
- `color`: один из значений палитры ниже либо `null` («цвет по умолчанию» —
  все категории без выбранного цвета выглядят одинаково нейтрально).
- Палитра (единственные допустимые значения; всё остальное → `400
  INVALID_COLOR`): `#A9544C`, `#B36A42`, `#A98A45`, `#4F7A5B`, `#47787A`,
  `#4C6B92`, `#6B5A8E`, `#9A5F7C`.

**Короткая ссылка на вишлист:** при создании вишлиста сервер генерирует
`shareToken` — короткий код **7 символов** из `[A-Za-z0-9]`, уникальный (при
коллизии — повторная генерация). Ссылка имеет вид `/w/<shareToken>` (≈ 9
символов пути). Ранее выданные длинные токены остаются действительными и не
меняются.

Правила: доступ только владельцу (иначе `404`). `visibility` принимает `public`
(доступен всем), `link` (только по ссылке) и `followers` (только подписчикам
владельца; прямая ссылка доступа не даёт). `showBookerNames=true` допустимо
только при `showBooked=true` (иначе `422 SHOW_NAMES_REQUIRES_BOOKED`, сервер не
«молча» включает).

**Категории (теги) — в рамках одного вишлиста:**
- `name` 1–40 символов, уникален внутри вишлиста (`409 CATEGORY_EXISTS`),
  максимум 20 категорий на список (`422 TOO_MANY_CATEGORIES`);
- `color` — из палитры выше или `null` (не выбран); невалидный цвет → `400
  INVALID_COLOR`;
- категорию видят все, кому доступен вишлист (это публичные данные списка);
- удаление категории снимает её с подарков (сами подарки остаются);
- у подарка максимум 5 категорий, все должны принадлежать его вишлисту
  (иначе `400 VALIDATION_ERROR`);
- при перемещении подарка в другой вишлист его категории сбрасываются
  (категории принадлежат списку).

## 4. Подарки

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/api/me/wishlists/:id/gifts` | `{title, description?, links?, categoryIds?, priceMinor?, currency?, priority?}` | `201 { gift }` |
| PATCH | `/api/me/gifts/:id` | те же поля кроме id/status | `200 { gift }` |
| DELETE | `/api/me/gifts/:id` | — | `204` |
| POST | `/api/me/wishlists/:id/gifts/reorder` | `{ order: [giftId, …] }` | `204` |
| POST | `/api/me/gifts/:id/status` | `{ status: "available" \| "gifted" }` | `200 { gift }` |
| POST | `/api/me/gifts/:id/move` | `{ wishlistId }` | `200 { gift }` |

Правила:
- доступ только владельцу вишлиста (иначе `404`);
- `priority` 1–5 (по умолчанию 3); `title` 1–200;
- `links`: массив 0–10 строк, каждая — валидный `http/https` URL (до 2000
  символов); порядок сохраняется, дубликаты удаляются; при `PATCH` поле
  **заменяет весь список** (передали `[]` — все ссылки удалены; не передали —
  список не меняется); невалидный URL → `400 VALIDATION_ERROR`;
- `sortOrder` назначается сервером (в конец списка);
- при `status: "gifted"` активная бронь закрывается:
  `cancelled_at = now`, `cancelled_reason = 'owner_gifted'`; подарок больше не
  бронируется (`422 GIFT_GIFTED` при попытке);
- обратно `available` разрешено, бронь не восстанавливается;
- владелец видит `booking` по правилам раздела 1 (по умолчанию `null`).

## 5. Публичный вишлист и бронирование (без регистрации)

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| GET | `/api/w/:shareToken` | — | `200 { wishlist: {id,title,description,eventDate,visibility,owner:{username,displayName,isProfilePublic}}, gifts: GiftDTO[], categories: CategoryDTO[], viewer: {isSelf,isFollowing,canFollow} }` |
| POST | `/api/w/:shareToken/gifts/:giftId/book` | `{name, email}` | `201 { booking: { createdAt } }` |
| POST | `/api/w/:shareToken/gifts/:giftId/unbook` | `{email}` | `200 { ok: true }` |

Правила просмотра: `public` — доступен всем (в т.ч. по ссылке); `link` — только
по токену; `followers` — только авторизованному подписчику владельца (прямая
ссылка не даёт доступа; гость → `404`). Несуществующий/недоступный токен →
`404 NOT_FOUND` (без пояснений). Владелец, смотрящий свою ссылку
неавторизованным, получает гостевой вид.

`viewer` в ответе — отношение смотрящего к владельцу списка (те же правила,
что у `viewer` в `GET /api/users/:username`): `isSelf`, `isFollowing`,
`canFollow`. Нужен клиенту для кнопок «Профиль» и «Подписаться» в шапке
публичного вишлиста. У закрытого профиля владельца `canFollow=false`.

### Бронирование
1. Проверки: вишлист доступен; подарок принадлежит ему; `status = available`;
   активной брони нет.
2. Валидация: `name` 1–100; `email` формат; нормализация email (trim + lower).
3. Транзакция `better-sqlite3`: вставка в `bookings`; при
   `SQLITE_CONSTRAINT_UNIQUE` → `409 GIFT_ALREADY_BOOKED`
   (текст: «Этот подарок уже забронировали»).
4. Успех: `201 { booking: { createdAt } }`; email в ответе **не возвращается**;
   письма не отправляются.
5. Лимит: 30 бронирований/час на IP → `429 TOO_MANY_REQUESTS`.
6. Подарок `gifted` → `422 GIFT_GIFTED`; нет подарка → `404`.

### Отмена
1. Ищем активную бронь подарка. Её нет — отвечаем так же, как при неверном
   email: `400 UNBOOK_FAILED` («Не удалось отменить бронирование. Проверьте
   email, который указывали при бронировании.») — не раскрываем, есть ли бронь.
2. Сравнение: `sha256(normalized + HASH_SECRET)` через
   `crypto.timingSafeEqual`. Не совпало → `400 UNBOOK_FAILED` (тот же текст).
3. Каждая попытка пишется в `booking_attempts` (ip_hash, email_hash, action,
   success). Больше 10 неудачных попыток на подарок за час или 30 на IP за час
   → `429 TOO_MANY_REQUESTS`.
4. Успех: `cancelled_at = now`, `cancelled_reason = 'visitor'`, `200 { ok: true }`.
5. Письма не отправляются.

## 6. Ограничения частоты (MVP)

| Действие | Правило |
|---|---|
| Вход | 10 попыток / 15 мин на IP+email |
| Регистрация | 5 / час на IP |
| Бронирование | 30 / час на IP |
| Отмена | 10 / час на подарок, 30 / час на IP (учитывается в `booking_attempts`) |

Реализация: простой счётчик в памяти процесса (`Map`) с очисткой; для отмены —
запросы к `booking_attempts`. Ответ `429` содержит `details.retryAfterSec`.

## 7. Приватность — обязательные инварианты (проверяются тестами)

1. Email бронирующего отсутствует в **любом** ответе API.
2. При `showBooked=false` владелец не получает поле `booking` ни в каком виде —
   ни в списке, ни в отдельном подарке, ни в агрегатах.
3. При `showBooked=true` и `showBookerNames=false` владелец видит только
   `{ status: "booked" }`, без имени.
4. Гость никогда не видит имя бронирующего, даже если владелец включил показ.
5. `404` вместо `403` для чужих/недоступных вишлистов и подарков.
6. Чужой профиль с `isProfilePublic=false` → `404` для всех, кроме владельца.

## 8. Что НЕ входит в MVP (не реализовывать сейчас)

Подписки и профили подписок, уведомления и письма, подтверждение email,
сброс пароля, смена email/пароля, удаление аккаунта, Яндекс ID, аватары и
загрузка файлов, категории и фильтры, режим карточек, автозаполнение по ссылке,
экспорт, массовое редактирование, видимость `followers`.

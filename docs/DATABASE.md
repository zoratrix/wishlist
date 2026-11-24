# Схема базы данных

> Схема **реализована** в `server/db/migrations/001_init.sql` (таблицы, индексы,
> ограничения). История изменений — `server/db/migrations/*.sql`.
> Код запросов — `better-sqlite3` (prepared statements, синхронные транзакции).

## 1. Общие принципы

1. **Одна база — SQLite**, файл `server/data/app.db`, режим WAL.
   Причина: не нужно ставить и настраивать сервер БД на Windows; база
   переносится вместе с папкой; резервная копия — копия файла.
2. **Все идентификаторы — строки UUID v4** (`crypto.randomUUID()`), а не числа:
   по номеру нельзя угадать чужой объект.
3. **Пользовательские данные удаляются физически** (hard delete) с каскадом —
   требование по персональным данным.
4. **Даты/время — TEXT в формате ISO 8601 UTC** (`2026-11-12T07:50:25.000Z`):
   сортируются как строки, читаются глазами в любом просмотрщике БД, не зависят
   от часового пояса. Значения подставляет приложение (не SQLite), формат
   единый.
5. **Булевы значения — INTEGER 0/1** (как принято в SQLite), в коде
   преобразуются явно.
6. **Цены — целые числа в копейках** (`priceMinor`): нет ошибок округления
   дробных чисел.
7. **Секреты не хранятся в открытом виде**: пароли — Argon2id, токены сессий и
   писем — SHA-256 хеши.
8. **Транзакции better-sqlite3 синхронные** — это делает проверку и запись
   атомарными без хитростей с блокировками.

## 2. Перечень таблиц

| Таблица | Назначение |
|---|---|
| `users` | аккаунты |
| `oauth_accounts` | привязка Яндекс ID |
| `sessions` | активные сессии входа |
| `email_tokens` | подтверждение почты, сброс пароля, смена email |
| `user_settings` | настройки уведомлений и приватности |
| `follows` | односторонние подписки |
| `wishlists` | вишлисты |
| `gifts` | подарки |
| `gift_links` | ссылки на товар (несколько вариантов у одного подарка) |
| `categories` | категории/теги вишлиста |
| `gift_categories` | связь подарок ↔ категория |
| `bookings` | брони (активные и отменённые) |
| `booking_attempts` | журнал попыток брони/отмены (антиперебор) |
| `notifications` | уведомления внутри сайта |
| `email_outbox` | очередь писем и защита от дублей |
| `schema_migrations` | применённые миграции (служебная) |

## 3. Таблицы

### 3.1. `users`

| Поле | Тип | Ограничения / смысл |
|---|---|---|
| id | TEXT | PK |
| email | TEXT | **UNIQUE**, нормализованный (trim + lowercase) |
| email_verified_at | TEXT? | когда подтверждён email |
| password_hash | TEXT? | Argon2id; NULL = вход только через Яндекс ID |
| username | TEXT | **UNIQUE**, 3–20 символов `a-z0-9_`, ссылка `/u/username` |
| display_name | TEXT | отображаемое имя |
| avatar_path | TEXT? | путь в `uploads/avatars/` |
| bio | TEXT? | до 300 символов |
| birth_month | INTEGER? | 1–12 |
| birth_day | INTEGER? | 1–31, проверка на существование даты в месяце |
| birth_year | INTEGER? | 1900…текущий; **необязателен** |
| show_birth_year | INTEGER | 0/1, показывать ли год на публичном профиле |
| timezone | TEXT | по умолчанию `Europe/Moscow` |
| is_profile_public | INTEGER | 0/1 |
| created_at / updated_at | TEXT | ISO UTC |

Инварианты (проверяются сервисным слоем и SQL-триггером/check):
- либо `password_hash`, либо привязка `oauth_accounts` — иначе аккаунт без
  способа входа;
- если задан `birth_year`, то месяц и день обязательны;
- `username` и `email` сравниваются в нижнем регистре.

### 3.2. `oauth_accounts`

| Поле | Тип | Ограничения |
|---|---|---|
| id | TEXT | PK |
| user_id | TEXT | FK → users, ON DELETE CASCADE |
| provider | TEXT | `yandex` |
| provider_user_id | TEXT | уникальный id у провайдера |
| email_at_provider | TEXT? | email от Яндекса |
| created_at | TEXT | |

Ограничения: `UNIQUE(provider, provider_user_id)`,
`UNIQUE(user_id, provider)` — один Яндекс на аккаунт.

### 3.3. `sessions`

| Поле | Тип | Ограничения |
|---|---|---|
| id | TEXT | PK |
| user_id | TEXT | FK → users, CASCADE |
| token_hash | TEXT | **UNIQUE** (SHA-256 от токена из cookie) |
| csrf_token | TEXT | токен CSRF, привязанный к сессии |
| created_at / last_seen_at | TEXT | |
| expires_at | TEXT | скользящий срок 30 дней |
| ip_hash | TEXT? | SHA-256 от IP |
| user_agent | TEXT? | до 255 символов |

Индексы: `token_hash`, `expires_at` (для периодической уборки).

### 3.4. `email_tokens`

| Поле | Тип | Ограничения |
|---|---|---|
| id | TEXT | PK |
| user_id | TEXT | FK → users, CASCADE |
| type | TEXT | `verify_email` \| `reset_password` \| `change_email` |
| token_hash | TEXT | **UNIQUE** |
| new_email | TEXT? | для `change_email` |
| expires_at | TEXT | verify 48 ч, reset 1 ч, change 1 ч |
| used_at | TEXT? | одноразовость |
| created_at | TEXT | |

### 3.5. `user_settings`

| Поле | Тип | По умолчанию | Смысл |
|---|---|---|---|
| user_id | TEXT | — | PK и FK → users, CASCADE |
| email_enabled | INTEGER | 1 | **мастер-выключатель писем** (кроме критичных: сброс пароля, подтверждение email) |
| email_birthday | INTEGER | 1 | напоминания о днях рождения |
| email_new_follower | INTEGER | 1 | новый подписчик |
| in_app_birthday | INTEGER | 1 | напоминания внутри сайта |
| in_app_new_follower | INTEGER | 1 | внутри сайта |

### 3.6. `follows`

| Поле | Тип |
|---|---|
| id | TEXT PK |
| follower_id | TEXT FK → users, CASCADE |
| following_id | TEXT FK → users, CASCADE |
| created_at | TEXT |

Ограничения: `UNIQUE(follower_id, following_id)`,
`CHECK(follower_id <> following_id)`. Подписка односторонняя; взаимная дружба
не моделируется. Списки подписчиков/подписок и счётчики видны только владельцу;
подписка на закрытый профиль запрещена, существующие подписки сохраняются.

### 3.7. `wishlists`

| Поле | Тип | Ограничения / смысл |
|---|---|---|
| id | TEXT | PK |
| owner_id | TEXT | FK → users, CASCADE |
| title | TEXT | 1–100 |
| description | TEXT? | до 2000 |
| cover_path | TEXT? | обложка в `uploads/covers/` |
| event_date | TEXT? | дата или повод, `YYYY-MM-DD` |
| visibility | TEXT | `public` \| `link` \| `followers` |
| share_token | TEXT | **UNIQUE**, короткий код **7 символов** `[A-Za-z0-9]`, ссылка `/w/<token>`; старые длинные токены остаются действительными |
| sort_order | INTEGER | порядок у владельца |
| show_booked | INTEGER | 0/1, по умолчанию **0** |
| show_booker_names | INTEGER | 0/1, по умолчанию **0**; действует только при `show_booked = 1` |
| created_at / updated_at | TEXT | |

Инварианты:
- `show_booker_names = 1` допустимо только при `show_booked = 1` (сервис
  приводит флаги в согласованное состояние);
- `share_token` не меняется при смене видимости, чтобы не сломать ранее
  отправленные ссылки.

### 3.8. `gifts`

| Поле | Тип | Ограничения / смысл |
|---|---|---|
| id | TEXT | PK |
| wishlist_id | TEXT | FK → wishlists, CASCADE |
| title | TEXT | **обязательно**, 1–200 |
| description | TEXT? | до 2000 |
| image_url | TEXT? | внешняя картинка (из Open Graph) |
| image_path | TEXT? | загруженная картинка в `uploads/gifts/` |
| price_minor | INTEGER? | цена в копейках, ≥ 0 |
| currency | TEXT | по умолчанию `RUB` |
| priority | INTEGER | 1–5 (1 — очень нужен) |
| status | TEXT | `available` \| `gifted` |
| sort_order | INTEGER | порядок в списке |
| created_at / updated_at | TEXT | |

Статус «забронирован» **не хранится** в `gifts`: вычисляется по наличию
активной брони — исключает рассинхронизацию. Наружу отдаётся вычисляемое поле
`bookingStatus`.

Ссылок на товар у подарка может быть **несколько** (например, плед понравился в
трёх магазинах) — они вынесены в отдельную таблицу `gift_links`, колонки `url`
в `gifts` больше нет (старые ссылки перенесены миграцией `002_gift_links.sql`).

### 3.8.1. `gift_links`

| Поле | Тип | Ограничения / смысл |
|---|---|---|
| id | TEXT | PK |
| gift_id | TEXT | FK → gifts, CASCADE |
| url | TEXT | валидный http/https URL, до 2000 символов |
| sort_order | INTEGER | порядок, заданный пользователем (0..9) |
| created_at | TEXT | |

Индекс: `gift_links(gift_id, sort_order)`. Ограничение: не более **10** ссылок
на подарок (проверяется сервисом, `400 VALIDATION_ERROR` при превышении),
дубликаты удаляются с сохранением первого вхождения. При удалении подарка
ссылки удаляются каскадом.

### 3.9. `categories` и `gift_categories` — теги вишлиста

`categories` (миграции `003_categories_scope.sql`, `004_category_color.sql`):
`id`, **`wishlist_id`** (FK → wishlists, CASCADE), `name` (1–40), **`color`**
(TEXT?, один из 8 цветов палитры или NULL — «по умолчанию»; палитра пастельная,
миграция `010_pastel_palette.sql` перекрашивает ранее сохранённые пресеты),
`created_at`;
`UNIQUE(wishlist_id, name)` — набор тегов принадлежит конкретному вишлисту, а не
пользователю (один и тот же «Книги» в двух списках — два разных тега).
Максимум 20 категорий на список (проверяется сервисом). Индекс по `wishlist_id`.

`gift_categories`: `gift_id` + `category_id`, составной PK, оба FK с CASCADE.
У подарка 0–5 тегов; при удалении категории связи удаляются, подарки остаются.
Индекс по `category_id`.

> Историческая справка: в `001_init.sql` категории были привязаны к владельцу, но
> API для них не существовало (только тестовые данные), поэтому `003` пересоздаёт
> таблицы с привязкой к вишлисту без потери пользовательских данных.

### 3.10. `bookings` — ключевая таблица

| Поле | Тип | Ограничения / смысл |
|---|---|---|
| id | TEXT | PK |
| gift_id | TEXT | FK → gifts, CASCADE |
| customer_name | TEXT | 1–100, как ввёл посетитель |
| customer_email | TEXT | как ввёл посетитель (для отображения не используется) |
| customer_email_norm | TEXT | trim + lowercase — **единственное поле для сравнения** |
| created_at | TEXT | |
| cancelled_at | TEXT? | NULL = бронь активна |
| cancelled_reason | TEXT? | `visitor` \| `owner_gifted` \| `gift_deleted` |

**Главный инвариант: у подарка не может быть двух активных броней.**

Двойная защита:
1. **База** — частичный уникальный индекс (обычный SQL, ограничений ORM нет):
   ```sql
   CREATE UNIQUE INDEX bookings_one_active_per_gift
     ON bookings(gift_id) WHERE cancelled_at IS NULL;
   ```
2. **Приложение** — бронирование выполняется синхронной транзакцией
   `better-sqlite3`: проверка подарка и вишлиста → вставка. Второй одновременный
   запрос получает ошибку `SQLITE_CONSTRAINT_UNIQUE`, которая превращается в
   `409 Conflict` «Подарок уже забронировали».

Индексы: `gift_id`, `customer_email_norm`, `cancelled_at`.

Правила:
- Отмена не удаляет строку, а проставляет `cancelled_at` → история сохраняется,
  уникальный индекс освобождает подарок.
- Владелец ставит «уже подарен» → активная бронь закрывается с причиной
  `owner_gifted`; подарок больше не бронируется.
- Удаление подарка/вишлиста каскадно удаляет брони.
- Автоснятия брони по времени **нет** (по ТЗ).

### 3.11. `booking_attempts`

| Поле | Тип | Смысл |
|---|---|---|
| id | TEXT PK | |
| gift_id | TEXT | FK → gifts, CASCADE |
| ip_hash | TEXT | SHA-256(IP + секрет) |
| email_hash | TEXT | SHA-256(email_norm + секрет) |
| action | TEXT | `book` \| `unbook` |
| success | INTEGER | 0/1 |
| created_at | TEXT | |

Назначение: лимит попыток отмены (защита от перебора email). Правило:
не больше 10 неудачных попыток на подарок за час и 30 на IP за час. Хранится в
БД, чтобы лимит переживал перезапуск. Индекс по `(gift_id, created_at)` и
`(ip_hash, created_at)`.

### 3.12. `notifications`

| Поле | Тип | Смысл |
|---|---|---|
| id | TEXT PK | |
| user_id | TEXT | FK → users, CASCADE (получатель) |
| type | TEXT | `new_follower` \| `birthday_1month` \| `birthday_2weeks` \| `system` |
| title / body | TEXT | текст для показа |
| payload_json | TEXT? | ссылки/идентификаторы (без email бронирующих) |
| dedupe_key | TEXT | **UNIQUE** — защита от дублей |
| created_at | TEXT | |
| read_at | TEXT? | |

`dedupe_key` для ДР: `birthday:{recipientId}:{heroId}:{2026}:{1m|2w}` —
повторная вставка невозможна, даже если планировщик запустится дважды.

### 3.13. `email_outbox`

| Поле | Тип | Смысл |
|---|---|---|
| id | TEXT PK | |
| to_email | TEXT | получатель |
| subject / body_html / body_text | TEXT | письмо |
| dedupe_key | TEXT | **UNIQUE** |
| status | TEXT | `pending` \| `sending` \| `sent` \| `failed` \| `cancelled` |
| attempts | INTEGER | число попыток |
| last_error | TEXT? | |
| not_before | TEXT | когда можно отправлять |
| sent_at | TEXT? | |
| created_at | TEXT | |

Письмо сначала попадает в очередь (в одной транзакции с уведомлением), затем
планировщик отправляет. Защита от дублей: уникальный `dedupe_key` + «захват»
задания одним запросом:
```sql
UPDATE email_outbox SET status='sending'
WHERE id IN (SELECT id FROM email_outbox
             WHERE status='pending' AND not_before <= :now
             ORDER BY created_at LIMIT 20)
RETURNING id;
```
При старте сервера записи в статусе `sending` старше 10 минут возвращаются в
`pending` — письмо не «зависнет» после падения.

## 4. Связи (ER текстом)

```
users 1─┬─* wishlists 1─* gifts
        ├─* follows (follower / following — две связи на users)
        ├─1 user_settings
        ├─* sessions, email_tokens, notifications, oauth_accounts
        └─* categories (через wishlist)

wishlists 1─* categories 1─* gift_categories *─1 gifts
gifts 1─* bookings            (активная бронь максимум одна)
gifts 1─* booking_attempts
gifts 1─* gift_links          (0–10 ссылок на товар, порядок пользователя)
wishlists *─1 users (owner)
```

## 5. Настройки SQLite при старте

```sql
PRAGMA journal_mode = WAL;    -- один раз: много читателей + один писатель
PRAGMA busy_timeout = 5000;   -- ждать блокировку до 5 с вместо ошибки
PRAGMA foreign_keys = ON;     -- каскады и целостность
PRAGMA synchronous = NORMAL;  -- безопасный компромисс с WAL
```
`journal_mode` записывается в сам файл базы и сохраняется; остальные
применяются к соединению и выставляются при открытии.

## 6. Миграции

- Миграции — **обычные SQL-файлы** `server/db/migrations/001_init.sql`,
  `002_gift_links.sql`, `003_categories_scope.sql`, `004_category_color.sql` и
  т.д. плюс строки в `schema_migrations`.
- Простой собственный раннер (`npm run db:migrate`): читает файлы по порядку,
  применяет неприменённые в транзакции, записывает номер. Прозрачно: видно
  точный SQL, который был выполнен.
- SQLite не умеет менять структуру «на месте» для многих случаев — миграции
  используют официальный паттерн: создать новую таблицу → перенести данные →
  переименовать. Это описывается в комментариях внутри миграции. В
  `002_gift_links.sql` использованы уже поддержанные SQLite 3.35+ операции
  (`ALTER TABLE ... DROP COLUMN`) с предварительным переносом данных в
  `gift_links`.
- `npm run db:seed` создаёт 2 тестовых пользователя, 4 вишлиста, 8 подарков
  (5 ссылок, у одного подарка — две) и одну активную бронь — для ручной проверки.
- Сервер при старте проверяет, что все миграции применены, и подсказывает
  команду, если нет (понятное сообщение вместо stack trace).

## 7. Резервное копирование и восстановление

- `npm run db:backup` → `VACUUM INTO 'backups/app-YYYY-MM-DD-HHmm.db'`:
  консистентный снимок работающей базы (не требует остановки сервера).
- Папка `uploads/` копируется вместе с базой.
- **Важно при восстановлении:** копия, созданная `VACUUM INTO`, открывается с
  `journal_mode=delete`. После восстановления нужно один раз включить WAL
  заново (`PRAGMA journal_mode=WAL`). Файл `uploads/` и база должны
  восстанавливаться «в паре» — иначе картинки не найдутся.
- Восстановление: остановить сервер, заменить `server/data/app.db`, запустить
  сервер (он включит WAL и применит миграции при необходимости).
- На сервере — ежедневный автобэкап (таймер systemd), храним 14 дней; при
  желании — копия в Yandex Object Storage.

## 8. Что важно для приватности

1. Email бронирующего **никогда** не попадает в ответы API; при отмене он
   только сравнивается на сервере.
2. Email владельца не показывается на публичной странице вишлиста.
3. При скрытых бронированиях сервер **не отправляет** ни одного поля брони —
   DTO формируется по роли смотрящего.
4. Владелец видит имя забронировавшего только при `show_booked = 1` и
   `show_booker_names = 1`.
5. `booking_attempts` хранит только хеши email/IP.
6. При удалении аккаунта удаляются его данные и гостевые брони, сделанные с его
   email (с предупреждением в интерфейсе).

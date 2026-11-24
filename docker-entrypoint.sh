#!/bin/sh
set -eu

echo "→ Применяю миграции базы данных…"
node server/dist/db/migrate.js

echo "→ Запускаю сервер «Хотелки» на порту ${PORT:-3000}…"
exec node server/dist/index.js

#!/bin/sh
# Восстановление из архива, сделанного deploy/backup.sh.
# Использование:  ./deploy/restore.sh backups/hotelets-20261124-120000.tar.gz
set -eu
cd "$(dirname "$0")/.."

ARCHIVE=${1:-}
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Использование: ./deploy/restore.sh <архив.tar.gz>" >&2
  exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)

echo "→ Останавливаю приложение…"
docker compose stop app >/dev/null

echo "→ Сохраняю текущие данные в data-before-restore-$STAMP…"
mv data "data-before-restore-$STAMP"

echo "→ Распаковываю архив…"
tar -xzf "$ARCHIVE"

echo "→ Запускаю приложение…"
docker compose start app >/dev/null

echo "Готово. Если что-то пошло не так, старые данные лежат в data-before-restore-$STAMP."

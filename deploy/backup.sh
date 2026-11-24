#!/bin/sh
# Резервная копия «Хотелок»: база + загруженные файлы (data/).
# Использование:  ./deploy/backup.sh [папка-для-бэкапов]
set -eu
cd "$(dirname "$0")/.."

BACKUP_DIR=${1:-./backups}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

if [ ! -d data ]; then
  echo "Ошибка: папка data/ не найдена. Запущены ли контейнеры из этой папки?" >&2
  exit 1
fi

echo "→ Останавливаю приложение на несколько секунд, чтобы база была согласована…"
docker compose stop app >/dev/null

echo "→ Архивирую data/…"
tar -czf "$BACKUP_DIR/hotelets-$STAMP.tar.gz" data

echo "→ Запускаю приложение обратно…"
docker compose start app >/dev/null

echo "Готово: $BACKUP_DIR/hotelets-$STAMP.tar.gz"
echo "Совет: храните бэкапы не только на этом сервере (например, копируйте в облако)."

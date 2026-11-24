#!/bin/sh
# Обновление сайта после того, как в репозитории появились новые изменения.
# Использование:  ./deploy/update.sh
set -eu
cd "$(dirname "$0")/.."

echo "→ Забираю изменения из Git…"
git pull --ff-only

echo "→ Пересобираю и перезапускаю контейнер…"
docker compose up -d --build

echo "→ Чищу старые слои образа…"
docker image prune -f >/dev/null

echo "Готово. Проверьте: docker compose ps  и  docker compose logs -f app"

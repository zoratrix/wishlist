# syntax=docker/dockerfile:1

# --- Сборка: TypeScript + Vite ---
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV CI=true

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY server ./server
COPY web ./web
RUN npm run build

# --- Runtime: только production-зависимости и собранные артефакты ---
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/app.db \
    UPLOAD_DIR=/data/uploads

# build-essential нужен на случай, если для better-sqlite3 нет готового
# бинарника под текущую версию Node — тогда пакет соберётся из исходников.
# После установки зависимости компилятор удаляем, чтобы образ не разрастался.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
# postinstall-скрипты нужны: better-sqlite3 и sharp готовят нативные бинарники.
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
COPY server/db ./server/db

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data/uploads

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["docker-entrypoint.sh"]

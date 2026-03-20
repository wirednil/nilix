# ── Stage 1: deps ─────────────────────────────────────────────────────────────
# Instala solo dependencias de producción.
# Separado del runtime para que eslint/pino-pretty no entren en la imagen final.
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Sin --no-bin-links: no necesario en Linux (overlay fs admite symlinks)
RUN npm ci --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Dependencias de producción desde el stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Código fuente — el .dockerignore excluye node_modules, .env, *.db, .git
COPY . .

# Directorios de datos (sobreescritos por volúmenes en docker-compose)
RUN mkdir -p data dev/dbase

RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000

# Primer arranque: init-dev.js si no hay auth.db → node server.js
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]

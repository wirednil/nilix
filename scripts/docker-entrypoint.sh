#!/bin/sh
# docker-entrypoint.sh — Nilix container startup
# On first run (no auth.db): initializes databases with the dev sandbox.
# On subsequent runs: skips init and starts directly.
set -e

AUTH_DB="${NIL_AUTH_DB:-data/auth.db}"

if [ ! -f "$AUTH_DB" ]; then
    echo "[entrypoint] Primera ejecución — inicializando bases de datos..."
    node utils/init-dev.js
    echo "[entrypoint] Init completo."
fi

exec node server.js

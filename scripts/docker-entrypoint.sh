#!/bin/sh
# docker-entrypoint.sh — Nilix container startup
# On first run (no auth.db): initializes databases with the dev sandbox.
# On subsequent runs: skips init and starts directly.
set -e

# Apps externas montadas en /app/appdata (ver docker-compose.yml) suelen
# tener handlers que hacen require(path.join(__dirname, '..', '..', 'nilix',
# ...)) — asume la misma estructura de hermanos que en desarrollo local
# (proyecto/{nilix,tu-app}/). Acá adentro el engine vive directo en /app, no
# en /app/nilix, así que ese require rompería sin este symlink. Se recrea en
# cada arranque porque /app se reconstruye entero con cada build de imagen.
[ -e /app/nilix ] || ln -s /app /app/nilix

AUTH_DB="${NIL_AUTH_DB:-data/auth.db}"

if [ ! -f "$AUTH_DB" ]; then
    echo "[entrypoint] Primera ejecución — inicializando bases de datos..."
    node utils/init-dev.js
    echo "[entrypoint] Init completo."
fi

exec node server.js

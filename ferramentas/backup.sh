#!/usr/bin/env bash
# ProRider — cópia do banco FORA do Railway (03/10e)
# O backup do Railway some se o volume for apagado; esta cópia fica no seu computador/HD.
# Uso (no computador do desenvolvedor, com o PostgreSQL client instalado):
#   DATABASE_PUBLIC_URL='postgres://...railway...' ./ferramentas/backup.sh
# (a URL pública fica no Railway → serviço Postgres → Variables → DATABASE_PUBLIC_URL)
# NUNCA coloque a pasta backups/ no GitHub (o repositório é público): ela está no .gitignore.
set -euo pipefail
: "${DATABASE_PUBLIC_URL:?Defina DATABASE_PUBLIC_URL (Railway → Postgres → Variables)}"
mkdir -p backups
f="backups/prorider_$(date +%F_%H%M).dump"
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_PUBLIC_URL" -f "$f"
pg_restore --list "$f" > /dev/null
echo "OK: $f ($(du -h "$f" | cut -f1))"
# guarda só os 30 mais novos
ls -1t backups/prorider_*.dump | tail -n +31 | xargs -r rm -f

#!/usr/bin/env bash
# ProRider — PROVA de que o backup volta (03/10e)
# Restaura um .dump num banco de TESTE e confere se as tabelas principais têm dados.
# Uso: TEST_DATABASE_URL='postgres://usuario:senha@localhost:5432/prorider_teste' ./ferramentas/restaurar-teste.sh backups/prorider_AAAA-MM-DD_HHMM.dump
set -euo pipefail
: "${TEST_DATABASE_URL:?Defina TEST_DATABASE_URL (um banco de TESTE, o nome precisa ter 'test')}"
case "$TEST_DATABASE_URL" in *test*) ;; *) echo "⛔ o banco precisa ter 'test' no nome"; exit 2;; esac
f="${1:?Informe o arquivo .dump}"
psql "$TEST_DATABASE_URL" -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-privileges -d "$TEST_DATABASE_URL" "$f"
for t in users licencas pagamentos aula_historico aulas_agenda loja_pedidos; do
  printf '%-16s %s\n' "$t" "$(psql "$TEST_DATABASE_URL" -Atc "select count(*) from $t" 2>/dev/null || echo 'FALTA')"
done
echo "OK: backup restaurado no banco de teste."

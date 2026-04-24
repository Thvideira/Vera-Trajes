#!/usr/bin/env bash
# Verificação pública: HTTPS, página inicial e /health (requer o proxy Nginx do frontend).
# Uso: PROD_URL="https://vera-store.cetara.dev.br" ./scripts/check-prod-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROD_URL="${PROD_URL:-https://vera-store.cetara.dev.br}"
PROD_URL="${PROD_URL%/}"

echo "==> Alvo: ${PROD_URL}"
echo ""

echo "==> GET / (espera HTML)..."
code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 -L "${PROD_URL}/")"
if [[ "${code}" == "200" ]]; then
  echo "    OK: HTTP ${code}"
else
  echo "    Falha: HTTP ${code} (proxy, stack 'web' ou certificado?)"
  exit 1
fi

echo "==> GET /health (API via Nginx)..."
hcode="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 -L "${PROD_URL}/health")"
hbody="$(curl -sS --connect-timeout 15 -L "${PROD_URL}/health" || true)"
if [[ "${hcode}" == "200" ]] && echo "$hbody" | grep -qE '"ok"[[:space:]]*:[[:space:]]*true'; then
  echo "    OK: HTTP ${hcode} e { ok: true }"
else
  echo "    Falha: HTTP ${hcode} (stack 'api', migrates, DATABASE_URL, ou rede?)"
  echo "    Resposta: ${hbody:0:200}"
  exit 1
fi

echo ""
echo "==> Tudo certo. No servidor, confirme: docker stack services <stack> (web e api 1/1) e 'docker service logs' se 502."
echo "    Comandos úteis (ver PRODUCAO.md):"
echo "      ssh ... 'docker service ls; docker service ps vera-trajes_api --no-trunc'"

#!/usr/bin/env bash
# ============================================================
# smoke-production.sh
# ------------------------------------------------------------
# Mesma validação do smoke-homologation.sh, porém com defaults
# voltados para o ambiente de produção: BASE_URL=8080 e
# credenciais EXIGIDAS via variável de ambiente (não há admin
# seed em produção real).
#
# Pré-requisitos: bash, curl, jq.
# Uso:
#   BASE_URL=https://api.clinica.exemplo.com \
#   ADMIN_EMAIL=admin@clinica.com \
#   ADMIN_PASSWORD=********** \
#     ./scripts/smoke-production.sh
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

pass() { echo "${GREEN}OK${NC}  $*"; }
fail() { echo "${RED}FAIL${NC} $*"; exit 1; }
info() { echo "${YELLOW}>>${NC}  $*"; }

command -v curl >/dev/null || fail "curl não encontrado no PATH"
command -v jq   >/dev/null || fail "jq não encontrado no PATH"

[[ -n "${ADMIN_EMAIL}"    ]] || fail "ADMIN_EMAIL não definido. Exporte antes de rodar."
[[ -n "${ADMIN_PASSWORD}" ]] || fail "ADMIN_PASSWORD não definido. Exporte antes de rodar."

info "Smoke test contra ${BASE_URL} (usuario=${ADMIN_EMAIL})"

# ── 1. Health ───────────────────────────────────────────────
status=$(curl -sk -o /tmp/smoke-prod-health.json -w '%{http_code}' "${BASE_URL}/actuator/health" || true)
[[ "${status}" == "200" ]] || fail "Health esperado 200, recebido ${status}"
health_status=$(jq -r '.status // empty' /tmp/smoke-prod-health.json)
[[ "${health_status}" == "UP" ]] || fail "Health body sem status=UP (recebido: ${health_status})"
pass "Health do gateway responde UP"

# ── 2. Login ────────────────────────────────────────────────
login_payload=$(jq -nc \
  --arg email "${ADMIN_EMAIL}" \
  --arg senha "${ADMIN_PASSWORD}" \
  '{email:$email, senha:$senha}')

status=$(curl -sk -o /tmp/smoke-prod-login.json -w '%{http_code}' \
  -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "${login_payload}" || true)

[[ "${status}" == "200" ]] || fail "Login esperado 200, recebido ${status} (body: $(cat /tmp/smoke-prod-login.json))"
TOKEN=$(jq -r '.data.token // empty' /tmp/smoke-prod-login.json)
[[ -n "${TOKEN}" ]] || fail "Login OK mas token vazio"
pass "Login retorna token JWT (len=${#TOKEN})"

# ── 3. GET autenticado ──────────────────────────────────────
status=$(curl -sk -o /tmp/smoke-prod-get.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/admin/v1/convenios" || true)
[[ "${status}" == "200" ]] || fail "GET /api/admin/v1/convenios esperado 200, recebido ${status}"
pass "GET /api/admin/v1/convenios responde 200 com token"

# ── 4. POST de escrita ──────────────────────────────────────
# Produção pode escolher se quer ou não fazer escrita real no smoke.
# Controla via SMOKE_WRITE=1 (default: 0, só leitura).
if [[ "${SMOKE_WRITE:-0}" == "1" ]]; then
  write_payload=$(jq -nc --arg nome "Smoke-prod-$(date +%s)" '{nome:$nome, descricao:"smoke prod"}')
  status=$(curl -sk -o /tmp/smoke-prod-post.json -w '%{http_code}' \
    -X POST "${BASE_URL}/api/admin/v1/convenios" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${write_payload}" || true)
  case "${status}" in
    200|201) pass "POST /api/admin/v1/convenios responde ${status}" ;;
    *) fail "POST /api/admin/v1/convenios esperado 200/201, recebido ${status}" ;;
  esac
else
  info "Pulando POST de escrita (defina SMOKE_WRITE=1 para incluir)"
fi

# ── 5. 401 sem token ────────────────────────────────────────
status=$(curl -sk -o /tmp/smoke-prod-401.json -w '%{http_code}' \
  "${BASE_URL}/api/admin/v1/convenios" || true)
[[ "${status}" == "401" ]] || fail "GET sem token esperado 401, recebido ${status}"
pass "GET sem token retorna 401 corretamente"

echo
echo "${GREEN}Smoke production OK.${NC}"

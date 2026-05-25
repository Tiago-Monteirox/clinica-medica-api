#!/usr/bin/env bash
# ============================================================
# smoke-homologation.sh
# ------------------------------------------------------------
# Valida rapidamente que a stack de homologation está saudável.
# Roda 5 verificações contra o Gateway:
#   1. Health (/actuator/health)
#   2. Login com usuário admin seed
#   3. GET autenticado em /api/admin/v1/convenios
#   4. POST de escrita em /api/admin/v1/convenios
#   5. GET sem token → 401 esperado
#
# Pré-requisitos: bash, curl, jq.
# Uso:
#   ./scripts/smoke-homologation.sh
#   BASE_URL=http://localhost:8084 ./scripts/smoke-homologation.sh
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8084}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@clinica.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

pass() { echo "${GREEN}OK${NC}  $*"; }
fail() { echo "${RED}FAIL${NC} $*"; exit 1; }
info() { echo "${YELLOW}>>${NC}  $*"; }

command -v curl >/dev/null || fail "curl não encontrado no PATH"
command -v jq   >/dev/null || fail "jq não encontrado no PATH (instale: apt/brew/choco)"

info "Smoke test contra ${BASE_URL}"

# ── 0. Wait probe ───────────────────────────────────────────
# /actuator/health do gateway sobe rapido e nao prova que o administrativo
# ja terminou o boot do Spring Boot/Hibernate. Antes dos checks de verdade,
# tentamos POST /auth/login com credenciais bobas ate receber 401/422 (=admin
# respondendo). Enquanto vier 5xx ou 000, considera ainda nao pronto.
# Pula este probe via SMOKE_SKIP_WAIT=1.
if [[ "${SMOKE_SKIP_WAIT:-0}" != "1" ]]; then
  info "Aguardando admin via gateway (timeout 120s)..."
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w '%{http_code}' \
      -X POST "${BASE_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"probe@p.com","senha":"probe"}' 2>/dev/null || echo 000)
    case "${code}" in
      401|422)
        pass "Stack pronta após ${i}*2s (admin respondeu HTTP ${code})"
        break
        ;;
      *)
        if [[ "${i}" == "60" ]]; then
          fail "Timeout (120s) — admin não respondeu HTTP 401/422 em /auth/login. Último: ${code}"
        fi
        sleep 2
        ;;
    esac
  done
fi

# ── 1. Health ───────────────────────────────────────────────
status=$(curl -s -o /tmp/smoke-health.json -w '%{http_code}' "${BASE_URL}/actuator/health" || true)
if [[ "${status}" != "200" ]]; then
  cat /tmp/smoke-health.json 2>/dev/null || true
  fail "Health do gateway esperado 200, recebido ${status}"
fi
health_status=$(jq -r '.status // empty' /tmp/smoke-health.json)
[[ "${health_status}" == "UP" ]] || fail "Health body sem status=UP (recebido: ${health_status})"
pass "Health do gateway responde UP"

# ── 2. Login ────────────────────────────────────────────────
login_payload=$(jq -nc \
  --arg email "${ADMIN_EMAIL}" \
  --arg senha "${ADMIN_PASSWORD}" \
  '{email:$email, senha:$senha}')

status=$(curl -s -o /tmp/smoke-login.json -w '%{http_code}' \
  -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "${login_payload}" || true)

if [[ "${status}" != "200" ]]; then
  cat /tmp/smoke-login.json 2>/dev/null || true
  fail "Login esperado 200, recebido ${status}"
fi
TOKEN=$(jq -r '.data.token // empty' /tmp/smoke-login.json)
[[ -n "${TOKEN}" ]] || fail "Login OK mas token vazio (payload: $(cat /tmp/smoke-login.json))"
pass "Login retorna token JWT (len=${#TOKEN})"

# ── 3. GET autenticado ──────────────────────────────────────
status=$(curl -s -o /tmp/smoke-get.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/admin/v1/convenios" || true)
[[ "${status}" == "200" ]] || fail "GET /api/admin/v1/convenios esperado 200, recebido ${status} (body: $(cat /tmp/smoke-get.json))"
pass "GET /api/admin/v1/convenios responde 200 com token"

# ── 4. POST de escrita ──────────────────────────────────────
write_payload=$(jq -nc --arg nome "Smoke-$(date +%s)" '{nome:$nome, descricao:"created by smoke test"}')
status=$(curl -s -o /tmp/smoke-post.json -w '%{http_code}' \
  -X POST "${BASE_URL}/api/admin/v1/convenios" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${write_payload}" || true)
case "${status}" in
  200|201) pass "POST /api/admin/v1/convenios responde ${status}" ;;
  *) fail "POST /api/admin/v1/convenios esperado 200/201, recebido ${status} (body: $(cat /tmp/smoke-post.json))" ;;
esac

# ── 5. 401 sem token ────────────────────────────────────────
status=$(curl -s -o /tmp/smoke-401.json -w '%{http_code}' \
  "${BASE_URL}/api/admin/v1/convenios" || true)
[[ "${status}" == "401" ]] || fail "GET sem token esperado 401, recebido ${status}"
pass "GET sem token retorna 401 corretamente"

echo
echo "${GREEN}Smoke homologation OK.${NC}"

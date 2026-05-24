#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8084}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@clinica.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

fail() {
  echo "FAIL $*" >&2
  exit 1
}

pass() {
  echo "OK   $*"
}

require_command() {
  command -v "$1" >/dev/null || fail "$1 não encontrado no PATH"
}

http_status() {
  local output_file="$1"
  shift
  curl -sS -o "${output_file}" -w '%{http_code}' "$@" || true
}

require_command curl
require_command jq

health_status="$(http_status /tmp/ci-smoke-health.json "${BASE_URL}/actuator/health")"
[[ "${health_status}" == "200" ]] || fail "GET /actuator/health esperado 200, recebido ${health_status}"
[[ "$(jq -r '.status // empty' /tmp/ci-smoke-health.json)" == "UP" ]] || fail "Gateway sem status UP"
pass "Gateway health UP"

login_payload="$(jq -nc \
  --arg email "${ADMIN_EMAIL}" \
  --arg senha "${ADMIN_PASSWORD}" \
  '{email:$email, senha:$senha}')"

login_status="$(http_status /tmp/ci-smoke-login.json \
  -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "${login_payload}")"
[[ "${login_status}" == "200" ]] || fail "POST /auth/login esperado 200, recebido ${login_status}"

token="$(jq -r '.data.token // empty' /tmp/ci-smoke-login.json)"
[[ -n "${token}" ]] || fail "Login não retornou token"
pass "Login retornou token"

private_status="$(http_status /tmp/ci-smoke-private.json \
  -H "Authorization: Bearer ${token}" \
  "${BASE_URL}/api/admin/v1/convenios")"
[[ "${private_status}" == "200" ]] || fail "GET autenticado /api/admin/v1/convenios esperado 200, recebido ${private_status}"
pass "Endpoint privado autenticado respondeu 200"

unauthorized_status="$(http_status /tmp/ci-smoke-unauthorized.json \
  "${BASE_URL}/api/admin/v1/convenios")"
[[ "${unauthorized_status}" == "401" ]] || fail "GET sem token esperado 401, recebido ${unauthorized_status}"
pass "Endpoint privado sem token respondeu 401"

#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE="${TMPDIR:-/tmp}/support-reply-assistant-smoke-cookie.txt"
SMOKE_EMAIL="${SMOKE_EMAIL:-admin@example.local}"

health="$(curl -fsS "$BASE_URL/api/health")"
printf '%s' "$health" | grep -q '"status":"ok"'

if [[ -z "${SMOKE_PASSWORD:-}" ]]; then
  printf 'SMOKE PASS: health. Bỏ qua login/session; chạy với SMOKE_PASSWORD để kiểm tra xác thực.\n'
  exit 0
fi

login="$(curl -fsS -c "$COOKIE_FILE" -H 'content-type: application/json' \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" \
  "$BASE_URL/api/auth/login")"
printf '%s' "$login" | grep -q "$SMOKE_EMAIL"

me="$(curl -fsS -b "$COOKIE_FILE" "$BASE_URL/api/auth/me")"
printf '%s' "$me" | grep -q '"role":"admin"'

providers="$(curl -fsS -b "$COOKIE_FILE" "$BASE_URL/api/providers")"
printf '%s' "$providers" | grep -q '"providers"'

printf 'SMOKE PASS: health, login, session/me, provider access\n'

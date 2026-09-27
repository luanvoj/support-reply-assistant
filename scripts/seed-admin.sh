#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log() { printf '[seed-admin] %s\n' "$*"; }
fail() { printf '[seed-admin] ✗ %s\n' "$*" >&2; exit 1; }

command -v npm >/dev/null 2>&1 || fail "Thiếu npm."
[[ -d node_modules ]] || fail "Chưa cài dependency. Hãy chạy npm ci."

log "Kiểm tra schema..."
npm run db:migrate

log "Tạo hoặc đặt lại tài khoản quản trị..."
npm run db:seed-admin

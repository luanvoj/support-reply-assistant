#!/usr/bin/env bash
# Local application controller for Git Bash on Windows.
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

APP_PORT="${APP_PORT:-3000}"
APP_HOST="${APP_HOST:-localhost}"
LOCAL_URL="http://localhost:${APP_PORT}"
RUN_DIR="$PROJECT_ROOT/.run"
LOG_FILE="$RUN_DIR/next-dev.log"

log() { printf '[support-reply-assistant] %s\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*"; }
fail() { printf '  ✗ %s\n' "$*" >&2; exit 1; }

require_command() { command -v "$1" >/dev/null 2>&1 || fail "Thiếu command: $1"; }

port_pid() {
  powershell.exe -NoProfile -Command "\$c=Get-NetTCPConnection -LocalPort $APP_PORT -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(\$c){\$c.OwningProcess}" 2>/dev/null | tr -d '\r' | head -n1
}

wait_for_health() {
  local attempts=30
  while (( attempts > 0 )); do
    curl -fsS --max-time 2 "$LOCAL_URL/api/health" >/dev/null 2>&1 && return 0
    sleep 1; ((attempts--))
  done
  return 1
}

clean_next() {
  local target="$PROJECT_ROOT/.next"
  [[ "$target" == "$PROJECT_ROOT/.next" ]] || fail "Đích dọn build không hợp lệ"
  local attempt
  for attempt in 1 2 3 4 5; do
    [[ -d "$target" ]] || return 0
    rm -rf -- "$target" 2>/dev/null || true
    [[ -d "$target" ]] || return 0
    sleep 1
  done
  fail "Không thể dọn bundle Next.js; một tiến trình Windows vẫn đang giữ tệp trong $target"
}

start() {
  require_command npm; require_command curl; require_command powershell.exe
  mkdir -p "$RUN_DIR"
  local pid
  pid="$(port_pid || true)"
  if [[ -n "$pid" ]]; then
    if curl -fsS --max-time 2 "$LOCAL_URL/api/health" >/dev/null 2>&1; then
      ok "Ứng dụng đang chạy tại $LOCAL_URL (PID $pid)"; return
    fi
    fail "Port $APP_PORT đang được PID $pid sử dụng. Chạy ./app.sh stop rồi thử lại."
  fi
  [[ -d node_modules ]] || fail "Thiếu node_modules. Chạy npm ci trước."
  log "Áp dụng migration Supabase..."
  npm run db:migrate || fail "Migration thất bại"
  log "Khởi động local dev server trên $LOCAL_URL..."
  nohup npm run dev -- --hostname "$APP_HOST" --port "$APP_PORT" >>"$LOG_FILE" 2>&1 &
  if ! wait_for_health; then
    tail -50 "$LOG_FILE" >&2 || true
    fail "Dev server không khởi động được"
  fi
  ok "Ứng dụng sẵn sàng: $LOCAL_URL"
  ok "Log: $LOG_FILE"
}

stop() {
  require_command powershell.exe
  local pid
  pid="$(port_pid || true)"
  if [[ -z "$pid" ]]; then warn "Không có ứng dụng nào lắng nghe port $APP_PORT"; return; fi
  log "Dừng ứng dụng trên port $APP_PORT (PID $pid)..."
  powershell.exe -NoProfile -Command "Stop-Process -Id $pid -Force -ErrorAction Stop" >/dev/null 2>&1 || fail "Không thể dừng PID $pid"
  ok "Đã dừng ứng dụng"
}

restart() {
  stop || true
  log "Dọn bundle Next.js cũ để tránh lỗi hot-reload..."
  clean_next
  start
}

status() {
  local pid
  pid="$(port_pid || true)"
  [[ -n "$pid" ]] && ok "Port $APP_PORT đang chạy (PID $pid)" || warn "Ứng dụng đang dừng"
  curl -fsS --max-time 2 "$LOCAL_URL/api/health" && printf '\n' || warn "Health endpoint chưa sẵn sàng"
}

logs() { [[ -f "$LOG_FILE" ]] || fail "Chưa có log: $LOG_FILE"; tail -f "$LOG_FILE"; }

case "${1:-start}" in
  start) start ;; stop) stop ;; restart) restart ;; status) status ;; logs) logs ;;
  clean) clean_next; ok "Đã dọn bundle Next.js" ;;
  help|-h|--help) printf 'Dùng: ./app.sh {start|stop|restart|status|logs|clean}\n' ;;
  *) fail "Lệnh không hợp lệ: $1" ;;
esac

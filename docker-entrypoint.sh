#!/bin/sh
set -eu

required_envs="DATABASE_URL AUTH_SECRET SECRETS_ENCRYPTION_KEY"
for name in $required_envs; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "[deploy] Missing required environment variable: $name" >&2
    exit 1
  fi
done

mkdir -p "$USER_STORAGE_DIR"

echo "[deploy] Applying idempotent database migration..."
npm run deploy:release

echo "[deploy] Starting application..."
exec "$@"

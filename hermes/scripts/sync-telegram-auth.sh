#!/bin/sh
# Sync Telegram auth: .env, s6 container env, and config.yaml YAML list allow_from.
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
export HERMES_HOME="$DATA_DIR"
ENV_FILE="$DATA_DIR/.env"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

normalize_env_value() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

resolve_telegram_allowed_users() {
  if [ -n "${TELEGRAM_ALLOWED_USERS:-}" ]; then
    normalize_env_value "${TELEGRAM_ALLOWED_USERS}"
    return 0
  fi
  if [ -f "$ENV_FILE" ] && grep -q "^TELEGRAM_ALLOWED_USERS=" "$ENV_FILE" 2>/dev/null; then
    normalize_env_value "$(grep "^TELEGRAM_ALLOWED_USERS=" "$ENV_FILE" | tail -1 | cut -d= -f2-)"
    return 0
  fi
  return 1
}

upsert_env_key() {
  key="$1"
  value="$2"
  value="$(normalize_env_value "$value")"
  [ -n "$value" ] || return 0
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

write_s6_env() {
  key="$1"
  value="$2"
  env_dir="/var/run/s6/container_environment"
  [ -d "$env_dir" ] || return 0
  printf '%s' "$value" > "$env_dir/$key"
}

if ! telegram_allowed="$(resolve_telegram_allowed_users)"; then
  echo "sync-telegram-auth: TELEGRAM_ALLOWED_USERS not set"
  exit 1
fi

export TELEGRAM_ALLOWED_USERS="$telegram_allowed"
upsert_env_key "TELEGRAM_ALLOWED_USERS" "$telegram_allowed"
write_s6_env "TELEGRAM_ALLOWED_USERS" "$telegram_allowed"

if id hermes >/dev/null 2>&1; then
  chown hermes:hermes "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$ENV_FILE" 2>/dev/null || true
fi

if command -v hermes >/dev/null 2>&1; then
  hermes config set gateway.platforms.telegram.enabled true 2>/dev/null || true
fi

python3 "$SCRIPT_DIR/sync-telegram-auth.py"

echo "sync-telegram-auth: done for user(s) $telegram_allowed"

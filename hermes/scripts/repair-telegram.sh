#!/bin/sh
# Run inside Railway Console on the Hermes service to repair Telegram wiring.
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
export HERMES_HOME="$DATA_DIR"
ENV_FILE="$DATA_DIR/.env"

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

telegram_allow_from_json() {
  allowed_csv="$(normalize_env_value "$1")"
  [ -n "$allowed_csv" ] || return 1
  json='['
  first=1
  old_ifs="$IFS"
  IFS=','
  # shellcheck disable=SC2086
  set -- $allowed_csv
  IFS="$old_ifs"
  for user_id in "$@"; do
    user_id="$(normalize_env_value "$user_id")"
    [ -n "$user_id" ] || continue
    if [ "$first" -eq 1 ]; then
      first=0
    else
      json="${json},"
    fi
    json="${json}\"${user_id}\""
  done
  json="${json}]"
  [ "$first" -eq 1 ] && return 1
  printf '%s' "$json"
}

echo "=== Hermes Telegram diagnostics ==="
echo "HERMES_HOME=$HERMES_HOME"
echo "TELEGRAM_ALLOWED_USERS (shell)=${TELEGRAM_ALLOWED_USERS:-<unset>}"
if telegram_allowed="$(resolve_telegram_allowed_users)"; then
  echo "Resolved allowlist: $telegram_allowed"
else
  echo "Resolved allowlist: <none>"
fi
echo "TELEGRAM_BOT_TOKEN set: $([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo yes || echo no)"
echo "TELEGRAM_WEBHOOK_URL=${TELEGRAM_WEBHOOK_URL:-<unset — polling mode>}"
echo "RAILWAY_SERVICE_ID=${RAILWAY_SERVICE_ID:-<unset>}"
echo ""
echo "If RAILWAY_SERVICE_ID points at THIS Hermes service, blog deploys will restart the gateway."
echo "It must be the saahomes.com website service ID, not Hermes."

echo ""
echo "--- /opt/data/.env (telegram lines) ---"
grep TELEGRAM "$DATA_DIR/.env" 2>/dev/null || echo "(no telegram lines in .env)"

echo ""
echo "--- config.yaml (telegram section) ---"
grep -A12 -i telegram "$DATA_DIR/config.yaml" 2>/dev/null || echo "(no telegram in config.yaml)"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo ""
  echo "--- Telegram getMe ---"
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | head -c 300
  echo ""
fi

LOG="$DATA_DIR/logs/gateways/default/current"
if [ -f "$LOG" ]; then
  echo ""
  echo "--- Recent gateway log (telegram/platform/auth/shutdown) ---"
  grep -iE 'telegram|platform|allowlist|webhook|unauthorized|blocked|shutdown|error|fatal|crash' "$LOG" | tail -30 || true
  echo ""
  echo "--- Last 15 log lines (any) ---"
  tail -15 "$LOG" || true
else
  echo ""
  echo "(no gateway log at $LOG — gateway may not have started)"
fi

echo ""
echo "=== Applying repair ==="
if command -v hermes >/dev/null 2>&1; then
  hermes config set gateway.platforms.telegram.enabled true
  if telegram_allowed="$(resolve_telegram_allowed_users)"; then
    if allow_from_json="$(telegram_allow_from_json "$telegram_allowed")"; then
      hermes config set gateway.platforms.telegram.extra.allow_from "$allow_from_json"
      echo "Set allow_from to: $allow_from_json"
    fi
  else
    echo "ERROR: TELEGRAM_ALLOWED_USERS not found in shell env or $ENV_FILE"
    echo "Set TELEGRAM_ALLOWED_USERS=6320126021 in Railway Variables, then rerun this script."
    exit 1
  fi
  echo ""
  echo "Config updated. Restart the Hermes service in Railway (Redeploy)."
  echo "After restart, message the bot and confirm the log does NOT show 'Blocked unauthorized user'."
else
  echo "hermes CLI not found — redeploy latest image, then run this script again."
fi

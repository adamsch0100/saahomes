#!/bin/sh
# Run inside Railway Console on the Hermes service to repair Telegram wiring.
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
export HERMES_HOME="$DATA_DIR"

echo "=== Hermes Telegram diagnostics ==="
echo "HERMES_HOME=$HERMES_HOME"
echo "TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS:-<unset>}"
echo "TELEGRAM_BOT_TOKEN set: $([ -n "${TELEGRAM_BOT_TOKEN:-}" ] && echo yes || echo no)"
echo "TELEGRAM_WEBHOOK_URL=${TELEGRAM_WEBHOOK_URL:-<unset — polling mode>}"

echo ""
echo "--- /opt/data/.env (telegram lines) ---"
grep TELEGRAM "$DATA_DIR/.env" 2>/dev/null || echo "(no telegram lines in .env)"

echo ""
echo "--- config.yaml (telegram section) ---"
grep -A8 -i telegram "$DATA_DIR/config.yaml" 2>/dev/null || echo "(no telegram in config.yaml)"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo ""
  echo "--- Telegram getMe ---"
  curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | head -c 300
  echo ""
fi

LOG="$DATA_DIR/logs/gateways/default/current"
if [ -f "$LOG" ]; then
  echo ""
  echo "--- Recent gateway log (telegram/platform) ---"
  grep -iE 'telegram|platform|allowlist|webhook|error' "$LOG" | tail -20 || true
fi

echo ""
echo "=== Applying repair ==="
if command -v hermes >/dev/null 2>&1; then
  hermes config set gateway.platforms.telegram.enabled true
  if [ -n "${TELEGRAM_ALLOWED_USERS:-}" ]; then
    hermes config set gateway.platforms.telegram.extra.allow_from "[\"${TELEGRAM_ALLOWED_USERS}\"]"
  fi
  echo "Config updated. Restart the Hermes service in Railway (Redeploy)."
else
  echo "hermes CLI not found — redeploy latest image, then run this script again."
fi

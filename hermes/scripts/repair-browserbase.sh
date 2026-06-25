#!/bin/sh
# Run inside Railway Console on the Hermes service to repair Browserbase env wiring.
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
export HERMES_HOME="$DATA_DIR"
ENV_FILE="$DATA_DIR/.env"

echo "=== Hermes Browserbase diagnostics ==="
echo "HERMES_HOME=$HERMES_HOME"
echo "Railway BROWSERBASE_API_KEY set: $([ -n "${BROWSERBASE_API_KEY:-}" ] && echo yes || echo no)"
echo "Railway BROWSERBASE_PROJECT_ID set: $([ -n "${BROWSERBASE_PROJECT_ID:-}" ] && echo yes || echo no)"

echo ""
echo "--- /opt/data/.env (browserbase lines) ---"
grep BROWSERBASE "$ENV_FILE" 2>/dev/null || echo "(no browserbase lines in .env)"

echo ""
echo "--- config.yaml (browser section) ---"
grep -A6 "^browser:" "$DATA_DIR/config.yaml" 2>/dev/null || echo "(no browser block in config.yaml)"

strip_quotes() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

upsert_env() {
  key="$1"
  value="$(strip_quotes "$2")"
  if [ -z "$value" ]; then
    return 0
  fi
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

echo ""
echo "=== Applying repair ==="
upsert_env "BROWSERBASE_API_KEY" "${BROWSERBASE_API_KEY:-}"
upsert_env "BROWSERBASE_PROJECT_ID" "${BROWSERBASE_PROJECT_ID:-}"

if id hermes >/dev/null 2>&1; then
  chown hermes:hermes "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$ENV_FILE" 2>/dev/null || true
fi

if command -v hermes >/dev/null 2>&1; then
  hermes config set browser.cloud_provider browserbase 2>/dev/null || true
  hermes config set browser.inactivity_timeout 300 2>/dev/null || true
  hermes config set 'tools.toolsets' '["web","terminal","files","browser"]' 2>/dev/null || true
  echo "Config updated."
else
  echo "hermes CLI not found — redeploy latest image first."
fi

echo ""
if [ -n "${BROWSERBASE_API_KEY:-}" ] && [ -n "${BROWSERBASE_PROJECT_ID:-}" ]; then
  echo "OK: Browserbase vars present in Railway. Redeploy Hermes service so the gateway reloads env."
else
  echo "BLOCKED: Add BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID to the Hermes service (not the main site), without quotes, then redeploy."
fi

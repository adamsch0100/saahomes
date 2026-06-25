#!/bin/sh
# Run inside Railway Console on the Hermes service to repair Browserbase env wiring.
# Railway Console injects service env vars into the shell even when s6 cont-init does not.
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
export HERMES_HOME="$DATA_DIR"
ENV_FILE="$DATA_DIR/.env"

echo "=== Hermes Browserbase diagnostics ==="
echo "HERMES_HOME=$HERMES_HOME"
echo "Railway BROWSERBASE_API_KEY set: $([ -n "${BROWSERBASE_API_KEY:-}" ] && echo yes || echo no)"
echo "Railway BROWSERBASE_PROJECT_ID set: $([ -n "${BROWSERBASE_PROJECT_ID:-}" ] && echo yes || echo no)"

browser_keys="$(env | grep -i '^BROWSER' | cut -d= -f1 | tr '\n' ' ')"
if [ -n "$browser_keys" ]; then
  echo "BROWSER* env key names in this shell: $browser_keys"
else
  echo "BROWSER* env key names in this shell: (none)"
fi

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
upsert_env "HERMES_HOME" "/opt/data"

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
if grep -q '^BROWSERBASE_API_KEY=.' "$ENV_FILE" 2>/dev/null && grep -q '^BROWSERBASE_PROJECT_ID=.' "$ENV_FILE" 2>/dev/null; then
  echo "OK: /opt/data/.env has Browserbase credentials. Redeploy the Hermes service so the gateway reloads."
elif [ -n "${BROWSERBASE_API_KEY:-}" ] && [ -n "${BROWSERBASE_PROJECT_ID:-}" ]; then
  echo "OK: Railway vars present in Console shell and written to .env. Redeploy Hermes service."
else
  echo "BLOCKED: Railway Console also lacks BROWSERBASE_* vars."
  echo "  → Open the Hermes service (root directory hermes), not the main saahomes site."
  echo "  → Variables tab → add exact names BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID (no quotes)."
  echo "  → Or paste into /opt/data/.env manually in this shell, then redeploy."
fi

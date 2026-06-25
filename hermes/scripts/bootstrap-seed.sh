#!/bin/sh
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
SEED_DIR="/seed"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/config.yaml" ] && [ -f "$SEED_DIR/config.yaml" ]; then
  echo "Seeding Hermes data directory at $DATA_DIR"
  cp -R "$SEED_DIR/." "$DATA_DIR/"
fi

WORKSPACE_DIR="$DATA_DIR/workspace/saahomes"
mkdir -p "$WORKSPACE_DIR/context"
mkdir -p "$WORKSPACE_DIR/outreach/pending"
mkdir -p "$WORKSPACE_DIR/outreach/sent"
mkdir -p "$WORKSPACE_DIR/outreach/skipped"
mkdir -p "$DATA_DIR/browser-sessions/gbp"
mkdir -p "$DATA_DIR/browser-sessions/meta"
mkdir -p "$DATA_DIR/browser-sessions/youtube"
mkdir -p "$DATA_DIR/browser-sessions/x"
if id hermes >/dev/null 2>&1; then
  chown -R hermes:hermes "$DATA_DIR/browser-sessions" 2>/dev/null || true
fi

if [ -f "$DATA_DIR/AGENTS.md" ] && [ ! -f "$WORKSPACE_DIR/AGENTS.md" ]; then
  cp "$DATA_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi

if [ -f "$SEED_DIR/workspace/saahomes/context/automation-registry.md" ] && [ ! -f "$WORKSPACE_DIR/context/automation-registry.md" ]; then
  cp -R "$SEED_DIR/workspace/saahomes/." "$WORKSPACE_DIR/"
fi

# Keep repo-shipped context docs current on every deploy (does not touch MEMORY.md).
if [ -d "$SEED_DIR/workspace/saahomes/context" ]; then
  cp -R "$SEED_DIR/workspace/saahomes/context/." "$WORKSPACE_DIR/context/"
fi
if [ -f "$SEED_DIR/USER.md" ]; then
  cp "$SEED_DIR/USER.md" "$DATA_DIR/USER.md"
fi
if [ -f "$SEED_DIR/AGENTS.md" ]; then
  cp "$SEED_DIR/AGENTS.md" "$DATA_DIR/AGENTS.md"
  cp "$SEED_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi

if [ ! -f "$DATA_DIR/.saahomes-bootstrapped" ]; then
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DATA_DIR/.saahomes-bootstrapped"
  echo "First boot: run AGENTS.md first-boot checklist and install cron jobs from automation-registry.md"
fi

ENV_FILE="$DATA_DIR/.env"
touch "$ENV_FILE"

append_env() {
  key="$1"
  value="$2"
  if [ -z "$value" ]; then
    return 0
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    return 0
  fi
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

upsert_env() {
  key="$1"
  value="$2"
  if [ -z "$value" ]; then
    return 0
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

upsert_env "OPENCODE_GO_API_KEY" "${OPENCODE_GO_API_KEY:-}"
upsert_env "TELEGRAM_BOT_TOKEN" "${TELEGRAM_BOT_TOKEN:-}"
upsert_env "TELEGRAM_ALLOWED_USERS" "${TELEGRAM_ALLOWED_USERS:-}"
append_env "API_SERVER_KEY" "${API_SERVER_KEY:-}"
append_env "API_SERVER_ENABLED" "${API_SERVER_ENABLED:-true}"
append_env "API_SERVER_HOST" "${API_SERVER_HOST:-0.0.0.0}"
append_env "API_SERVER_CORS_ORIGINS" "${API_SERVER_CORS_ORIGINS:-*}"

append_env "HERMES_DASHBOARD" "${HERMES_DASHBOARD:-1}"
append_env "HERMES_DASHBOARD_HOST" "${HERMES_DASHBOARD_HOST:-0.0.0.0}"
append_env "HERMES_DASHBOARD_PORT" "${HERMES_DASHBOARD_PORT:-9119}"
append_env "HERMES_DASHBOARD_BASIC_AUTH_USERNAME" "${HERMES_DASHBOARD_BASIC_AUTH_USERNAME:-}"
append_env "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD" "${HERMES_DASHBOARD_BASIC_AUTH_PASSWORD:-}"
append_env "HERMES_DASHBOARD_BASIC_AUTH_SECRET" "${HERMES_DASHBOARD_BASIC_AUTH_SECRET:-}"
append_env "SERPAPI_API_KEY" "${SERPAPI_API_KEY:-}"
upsert_env "GITHUB_TOKEN" "${GITHUB_TOKEN:-}"
upsert_env "GITHUB_REPO" "${GITHUB_REPO:-adamsch0100/saahomes}"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  upsert_env "GH_TOKEN" "${GITHUB_TOKEN}"
fi
upsert_env "RAILWAY_TOKEN" "${RAILWAY_TOKEN:-}"
upsert_env "RAILWAY_SERVICE_ID" "${RAILWAY_SERVICE_ID:-}"
append_env "GA4_PROPERTY_ID" "${GA4_PROPERTY_ID:-G-CB5GL0P3EZ}"
append_env "OUTREACH_APPROVAL_REQUIRED" "${OUTREACH_APPROVAL_REQUIRED:-true}"
append_env "AUTO_MERGE_SEO_PRS" "${AUTO_MERGE_SEO_PRS:-true}"
upsert_env "BROWSERBASE_API_KEY" "${BROWSERBASE_API_KEY:-}"
upsert_env "BROWSERBASE_PROJECT_ID" "${BROWSERBASE_PROJECT_ID:-}"
append_env "BROWSER_INACTIVITY_TIMEOUT" "${BROWSER_INACTIVITY_TIMEOUT:-300}"
upsert_env "OUTREACH_SMTP_HOST" "${OUTREACH_SMTP_HOST:-}"
upsert_env "OUTREACH_SMTP_USER" "${OUTREACH_SMTP_USER:-}"
upsert_env "OUTREACH_SMTP_PASSWORD" "${OUTREACH_SMTP_PASSWORD:-}"

CREDENTIALS_DIR="$DATA_DIR/credentials"
mkdir -p "$CREDENTIALS_DIR"
chmod 700 "$CREDENTIALS_DIR"
GSC_KEY_FILE="$CREDENTIALS_DIR/gsc-service-account.json"

if [ -n "${GSC_SERVICE_ACCOUNT_JSON_B64:-}" ]; then
  echo "Writing GSC service account key from GSC_SERVICE_ACCOUNT_JSON_B64"
  printf '%s' "$GSC_SERVICE_ACCOUNT_JSON_B64" | base64 -d > "$GSC_KEY_FILE"
  chmod 600 "$GSC_KEY_FILE"
elif [ -n "${GSC_SERVICE_ACCOUNT_JSON:-}" ]; then
  echo "Writing GSC service account key from GSC_SERVICE_ACCOUNT_JSON"
  printf '%s' "$GSC_SERVICE_ACCOUNT_JSON" > "$GSC_KEY_FILE"
  chmod 600 "$GSC_KEY_FILE"
fi

# Bootstrap and manual Console uploads run as root; gateway runs as hermes.
if [ -f "$GSC_KEY_FILE" ] && id hermes >/dev/null 2>&1; then
  chown hermes:hermes "$CREDENTIALS_DIR" "$GSC_KEY_FILE"
  chmod 700 "$CREDENTIALS_DIR"
  chmod 600 "$GSC_KEY_FILE"
fi

# Hermes agent reads git credentials from /opt/data/.env — sync from Railway on every boot.
if [ -n "${GITHUB_TOKEN:-}" ] && [ ! -d "$WORKSPACE_DIR/.git" ]; then
  REPO="${GITHUB_REPO:-adamsch0100/saahomes}"
  echo "Cloning github.com/${REPO} for autonomous SEO work"
  CLONE_TMP="$(mktemp -d)"
  git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$CLONE_TMP"
  if [ -d "$WORKSPACE_DIR/context" ]; then
    mkdir -p "$CLONE_TMP/context"
    cp -R "$WORKSPACE_DIR/context/." "$CLONE_TMP/context/"
  fi
  rm -rf "$WORKSPACE_DIR"
  mv "$CLONE_TMP" "$WORKSPACE_DIR"
  mkdir -p "$WORKSPACE_DIR/context"
  if [ -d "$SEED_DIR/workspace/saahomes/context" ]; then
    cp -R "$SEED_DIR/workspace/saahomes/context/." "$WORKSPACE_DIR/context/"
  fi
  git -C "$WORKSPACE_DIR" config user.email "hermes@saahomes.com"
  git -C "$WORKSPACE_DIR" config user.name "SAA Homes Hermes"
fi

# Volume seeded on first boot may predate gateway.platforms.telegram in config.yaml.
export HERMES_HOME="$DATA_DIR"
if command -v hermes >/dev/null 2>&1; then
  hermes config set gateway.platforms.telegram.enabled true 2>/dev/null || true
  if [ -n "${TELEGRAM_ALLOWED_USERS:-}" ]; then
    hermes config set gateway.platforms.telegram.extra.allow_from "[\"${TELEGRAM_ALLOWED_USERS}\"]" 2>/dev/null || true
  fi
  hermes config set browser.cloud_provider browserbase 2>/dev/null || true
  hermes config set browser.inactivity_timeout 300 2>/dev/null || true
  hermes config set 'tools.toolsets' '["web","terminal","files","browser"]' 2>/dev/null || true
fi
